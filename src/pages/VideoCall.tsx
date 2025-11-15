import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from "lucide-react";

interface ChildSession {
  id: string;
  name: string;
  avatar_color: string;
}

const VideoCall = () => {
  const { childId } = useParams();
  const [isChild, setIsChild] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [callId, setCallId] = useState<string | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidateInit[]>([]);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const childSession = localStorage.getItem("childSession");
    const isChildUser = !!childSession;
    setIsChild(isChildUser);
    
    initializeCall(isChildUser);

    return () => {
      cleanup();
    };
  }, [childId]);

  const initializeCall = async (isChildUser: boolean) => {
    try {
      // Get media stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      peerConnectionRef.current = pc;

      // Add local stream tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });

      // Handle remote stream
      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        setRemoteStream(remoteStream);
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStream;
        }
      };

      // Handle ICE candidates - store in appropriate field based on role
      pc.onicecandidate = async (event) => {
        if (event.candidate && callId) {
          const field = isChildUser ? 'child_ice_candidates' : 'parent_ice_candidates';
          const { data: call } = await supabase
            .from("calls")
            .select(field)
            .eq("id", callId)
            .maybeSingle();

          if (call) {
            const candidates = (call[field] as any[]) || [];
            candidates.push(event.candidate.toJSON());

            await supabase
              .from("calls")
              .update({ [field]: candidates })
              .eq("id", callId);
          }
        }
      };

      // Set up call based on role
      if (isChildUser) {
        await handleChildCall(pc);
      } else {
        await handleParentCall(pc);
      }
    } catch (error: any) {
      toast({
        title: "Connection Error",
        description: error.message,
        variant: "destructive",
      });
      setIsConnecting(false);
    }
  };

  const handleParentCall = async (pc: RTCPeerConnection) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !childId) return;

      // Create call record
      const { data: call, error } = await supabase
        .from("calls")
        .insert({
          child_id: childId,
          parent_id: user.id,
          caller_type: "parent",
          status: "ringing",
        })
        .select()
        .single();

      if (error || !call) throw new Error("Failed to create call");
      setCallId(call.id);

      // Create and set offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await supabase
        .from("calls")
        .update({ offer: { type: offer.type, sdp: offer.sdp } })
        .eq("id", call.id);

      // Listen for answer and child ICE candidates
      const channel = supabase
        .channel(`call:${call.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "calls",
            filter: `id=eq.${call.id}`,
          },
          async (payload) => {
            const updatedCall = payload.new as any;
            
            // Handle call being ended or declined
            if (updatedCall.status === 'ended') {
              cleanup();
              navigate('/parent/dashboard');
              return;
            }
            
            if (updatedCall.answer && pc.remoteDescription === null) {
              const answerDesc = updatedCall.answer as any;
              await pc.setRemoteDescription(
                new RTCSessionDescription(answerDesc)
              );
              
              // Process queued ICE candidates
              for (const candidate of iceCandidatesQueue.current) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              }
              iceCandidatesQueue.current = [];
              setIsConnecting(false);
            }

            // Add child ICE candidates
            if (updatedCall.child_ice_candidates) {
              const candidates = updatedCall.child_ice_candidates as RTCIceCandidateInit[];
              const currentCount = iceCandidatesQueue.current.length;
              const newCandidates = candidates.slice(currentCount);
              
              for (const candidate of newCandidates) {
                if (pc.remoteDescription) {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } else {
                  iceCandidatesQueue.current.push(candidate);
                }
              }
            }
          }
        )
        .subscribe();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleChildCall = async (pc: RTCPeerConnection) => {
    try {
      const childSession = localStorage.getItem("childSession");
      if (!childSession) return;

      const child: ChildSession = JSON.parse(childSession);

      // Find active call (either incoming or outgoing)
      const { data: call } = await supabase
        .from("calls")
        .select("*")
        .eq("child_id", child.id)
        .in("status", ["ringing", "active"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!call) {
        toast({
          title: "No Call Found",
          description: "No active call",
          variant: "destructive",
        });
        navigate("/child/dashboard");
        return;
      }

      setCallId(call.id);

      // Set remote description (offer)
      if (call.offer) {
        const offerDesc = call.offer as any;
        await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));
      }

      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      // Update call with answer
      await supabase
        .from("calls")
        .update({
          answer: { type: answer.type, sdp: answer.sdp },
          status: "active",
        })
        .eq("id", call.id);

      setIsConnecting(false);

      // Listen for parent ICE candidates and call status
      const channel = supabase
        .channel(`call:${call.id}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "calls",
            filter: `id=eq.${call.id}`,
          },
          async (payload) => {
            const updatedCall = payload.new as any;
            
            // Handle call being ended or declined
            if (updatedCall.status === 'ended') {
              cleanup();
              navigate('/child/dashboard');
              return;
            }
            
            if (updatedCall.parent_ice_candidates) {
              const candidates = updatedCall.parent_ice_candidates as RTCIceCandidateInit[];
              for (const candidate of candidates) {
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                  console.error('Error adding ICE candidate:', error);
                }
              }
            }
          }
        )
        .subscribe();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach((track) => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach((track) => {
        track.enabled = isVideoOff;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = async () => {
    if (callId) {
      await supabase
        .from("calls")
        .update({ status: "ended", ended_at: new Date().toISOString() })
        .eq("id", callId);
    }
    cleanup();
    navigate(isChild ? "/child/dashboard" : "/parent/dashboard");
  };

  const cleanup = () => {
    if (localStream) {
      localStream.getTracks().forEach((track) => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
  };

  return (
    <div className="fixed inset-0 bg-black">
      <div className="relative h-full w-full">
        {/* Remote video (full screen) */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        {/* Connection status */}
        {!remoteStream && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <div className="text-center space-y-4">
              <div className="text-6xl">📞</div>
              <p className="text-white text-2xl">
                {isConnecting ? "Connecting..." : "Waiting for other person..."}
              </p>
              {isConnecting && (
                <Button
                  onClick={endCall}
                  variant="destructive"
                  size="lg"
                  className="mt-4"
                >
                  <PhoneOff className="mr-2 h-5 w-5" />
                  Decline Call
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        <div className="absolute top-4 right-4 w-48 h-36 rounded-2xl overflow-hidden shadow-xl border-2 border-white">
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>

        {/* Controls */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-4">
          <Button
            onClick={toggleMute}
            size="lg"
            variant={isMuted ? "destructive" : "secondary"}
            className="rounded-full w-16 h-16"
          >
            {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>

          <Button
            onClick={toggleVideo}
            size="lg"
            variant={isVideoOff ? "destructive" : "secondary"}
            className="rounded-full w-16 h-16"
          >
            {isVideoOff ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>

          <Button
            onClick={endCall}
            size="lg"
            variant="destructive"
            className="rounded-full w-16 h-16"
          >
            <PhoneOff className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default VideoCall;
