// src/components/CodeManagementDialogs.tsx
// Purpose: Dialogs for managing child login codes (view, edit, delete, print)

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Copy, ExternalLink, Printer, X, RefreshCw } from "lucide-react";
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Child {
  id: string;
  name: string;
  login_code: string;
  avatar_color: string;
}

interface CodeManagementDialogsProps {
  // Code View Dialog
  showCodeDialog: { child: Child } | null;
  onCloseCodeDialog: () => void;
  getFullLoginCode: (child: Child) => string;
  onCopyCode: (code: string) => void;
  onCopyMagicLink: (child: Child) => void;
  onPrintCode: (child: Child) => void;

  // Edit Code Dialog
  childToEditCode: Child | null;
  onCloseEditCode: () => void;
  onUpdateLoginCode: () => void;
  isUpdatingCode: boolean;

  // Delete Child Dialog
  childToDelete: Child | null;
  onCloseDelete: () => void;
  onDeleteChild: () => void;

  // Print View Dialog
  printViewChild: Child | null;
  onClosePrintView: () => void;
  onPrintFromModal: () => void;
}

interface QRCodeDisplayProps {
  child: Child;
  getFullLoginCode: (child: Child) => string;
  fetchFamilyCode: () => Promise<string | null>;
  isRefreshing: boolean;
  onRetry: () => void;
  size?: "normal" | "large";
}

const QRCodeDisplay = ({ 
  child, 
  getFullLoginCode, 
  fetchFamilyCode, 
  isRefreshing,
  onRetry,
  size = "normal"
}: QRCodeDisplayProps) => {
  const [validatedCode, setValidatedCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const validatedCodeRef = useRef<string | null>(null);
  const childIdRef = useRef<string | null>(null);

  useEffect(() => {
    // Skip if we already have a valid code for this child and not refreshing
    if (validatedCodeRef.current && childIdRef.current === child.id && !isRefreshing) {
      return;
    }

    // Reset if child changed
    if (childIdRef.current !== child.id) {
      validatedCodeRef.current = null;
      childIdRef.current = child.id;
      setValidatedCode(null);
    }

    const validateAndFetch = async () => {
      setIsLoading(true);
      setHasError(false);
      
      let fullCode = getFullLoginCode(child);
      const parts = fullCode.split("-");
      
      // Check if code is already valid
      if (parts.length === 3 && parts[0].length === 6) {
        validatedCodeRef.current = fullCode;
        setValidatedCode(fullCode);
        setIsLoading(false);
        return;
      }
      
      // Try to fetch family code
      try {
        const fetchedFamilyCode = await fetchFamilyCode();
        
        if (fetchedFamilyCode && fetchedFamilyCode.trim().length > 0) {
          fullCode = `${fetchedFamilyCode.trim()}-${child.login_code}`;
          const newParts = fullCode.split("-");
          if (newParts.length === 3 && newParts[0].length === 6) {
            validatedCodeRef.current = fullCode;
            setValidatedCode(fullCode);
            setIsLoading(false);
            return;
          } else {
            console.warn("[QRCodeDisplay] Validation failed - parts:", newParts, "expected 3 parts, first part length:", newParts[0]?.length);
          }
        } else {
          console.warn("[QRCodeDisplay] Family code is null or empty");
        }
      } catch (error) {
        console.error("[QRCodeDisplay] Error fetching family code:", error);
      }
      
      // If we get here, validation failed
      setHasError(true);
      setIsLoading(false);
    };

    validateAndFetch();
  }, [child, getFullLoginCode, fetchFamilyCode, isRefreshing]);

  const handleRetry = async () => {
    onRetry();
    setIsLoading(true);
    setHasError(false);
    
    try {
      console.log("[QRCodeDisplay] Retry: Fetching family code...");
      const fetchedFamilyCode = await fetchFamilyCode();
      if (fetchedFamilyCode && fetchedFamilyCode.trim().length > 0) {
        const fullCode = `${fetchedFamilyCode.trim()}-${child.login_code}`;
        console.log("[QRCodeDisplay] Retry: Constructed full code:", fullCode);
        const parts = fullCode.split("-");
        if (parts.length === 3 && parts[0].length === 6) {
          console.log("[QRCodeDisplay] Retry: Validation successful");
          setValidatedCode(fullCode);
          setHasError(false);
        } else {
          console.warn("[QRCodeDisplay] Retry: Validation failed - parts:", parts);
          setHasError(true);
        }
      } else {
        console.warn("[QRCodeDisplay] Retry: Family code is null or empty");
        setHasError(true);
      }
    } catch (error) {
      console.error("[QRCodeDisplay] Retry: Error fetching family code:", error);
      setHasError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const dimensions = size === "large" 
    ? "w-[250px] h-[250px] sm:w-[300px] sm:h-[300px]"
    : "w-[200px] h-[200px] sm:w-[250px] sm:h-[250px]";
  
  const qrSize = size === "large" ? "300x300" : "200x200";

  if (isLoading || isRefreshing) {
    return (
      <div className={`border-2 border-muted rounded-lg ${dimensions} flex items-center justify-center p-4`}>
        <div className="flex flex-col items-center gap-2">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-xs text-muted-foreground text-center">Loading QR code...</p>
        </div>
      </div>
    );
  }

  if (hasError || !validatedCode) {
    return (
      <div className={`border-2 border-destructive rounded-lg ${dimensions} flex flex-col items-center justify-center p-4 ${size === "large" ? "print:border-gray-800" : ""}`}>
        <p className={`text-sm text-destructive text-center mb-3 ${size === "large" ? "print:text-gray-600" : ""}`}>
          QR code unavailable: Family code missing.
        </p>
        <Button
          onClick={handleRetry}
          variant="outline"
          size="sm"
          className="print:hidden"
          disabled={isRefreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Retry
        </Button>
        <p className="text-xs text-muted-foreground text-center mt-2 print:text-gray-600 print:mt-0">
          {size === "large" ? "Please refresh the page or contact support." : "Please try again or refresh the page."}
        </p>
      </div>
    );
  }

  // Use QR code API with gradient colors and logo support
  // Using qrcodeapi.io style with colored QR code
  // Match the magic link format exactly: /child/login?code=ENCODED_CODE
  const encodedCode = encodeURIComponent(validatedCode);
  const magicLink = `${window.location.origin}/child/login?code=${encodedCode}`;
  const logoUrl = `${window.location.origin}/icon-96x96.png`;
  
  // Generate QR code with high error correction for logo overlay
  // Using gradient colors: pink/red to lime green (similar to example)
  // Color format: foreground color (dark) and background (light)
  // QR code API will handle URL encoding, so pass the full URL
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}&ecc=H&margin=2&data=${encodeURIComponent(magicLink)}&color=ff6b9d&bgcolor=ffffff`;

  console.log("[QRCodeDisplay] Rendering QR code with gradient and embedded logo");

  return (
    <div className={`relative ${dimensions} border-2 border-white rounded-2xl ${size === "large" ? "print:border-gray-800 rounded-3xl" : ""} flex items-center justify-center bg-white mx-auto overflow-hidden shadow-sm`}>
      {/* QR Code with gradient overlay */}
      <div className="relative w-full h-full">
        <img
          src={qrUrl}
          alt="QR Code"
          className="w-full h-full object-contain"
          style={{
            filter: 'brightness(0.9)',
          }}
          onError={(e) => {
            console.error("[QRCodeDisplay] QR code image failed to load:", e);
          }}
          onLoad={() => {
            console.log("[QRCodeDisplay] QR code image loaded successfully");
          }}
        />
        {/* Gradient overlay for pink-to-green effect */}
        <div 
          className="absolute inset-0 pointer-events-none mix-blend-multiply opacity-60"
          style={{
            background: 'linear-gradient(135deg, rgba(255, 107, 157, 0.4) 0%, rgba(50, 205, 50, 0.4) 100%)',
          }}
        />
      </div>
      {/* Circular logo in center with colored background */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className={`bg-gradient-to-br from-lime-400 to-lime-500 ${size === "large" ? "w-16 h-16 p-2" : "w-14 h-14 p-1.5"} rounded-full shadow-lg flex items-center justify-center`}>
          <img
            src={logoUrl}
            alt="Kids Call Home"
            className={`${size === "large" ? "w-12 h-12" : "w-11 h-11"} rounded-full object-cover`}
            width={size === "large" ? 48 : 44}
            height={size === "large" ? 48 : 44}
            loading="eager"
            decoding="async"
          />
        </div>
      </div>
    </div>
  );
};

export const CodeManagementDialogs = ({
  showCodeDialog,
  onCloseCodeDialog,
  getFullLoginCode,
  onCopyCode,
  onCopyMagicLink,
  onPrintCode,
  childToEditCode,
  onCloseEditCode,
  onUpdateLoginCode,
  isUpdatingCode,
  childToDelete,
  onCloseDelete,
  onDeleteChild,
  printViewChild,
  onClosePrintView,
  onPrintFromModal,
}: CodeManagementDialogsProps) => {
  const [isRefreshingFamilyCode, setIsRefreshingFamilyCode] = useState(false);

  // Function to fetch family code from database - memoized to prevent unnecessary re-renders
  const fetchFamilyCode = useCallback(async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn("[fetchFamilyCode] No session found");
        return null;
      }
      
      const { data: parentData, error } = await supabase
        .from("parents")
        .select("family_code")
        .eq("id", session.user.id)
        .maybeSingle();
      
      if (error) {
        console.error("[fetchFamilyCode] Error fetching family code:", error);
        return null;
      }
      
      const familyCode = parentData?.family_code || null;
      return familyCode;
    } catch (error) {
      console.error("[fetchFamilyCode] Exception fetching family code:", error);
      return null;
    }
  }, []);

  // Reset refreshing state when dialog opens/closes
  useEffect(() => {
    if (showCodeDialog) {
      setIsRefreshingFamilyCode(false);
    }
  }, [showCodeDialog]);

  useEffect(() => {
    if (printViewChild) {
      setIsRefreshingFamilyCode(false);
    }
  }, [printViewChild]);

  return (
    <>
      {/* Code View Dialog */}
      {showCodeDialog && (
        <AlertDialog
          open={!!showCodeDialog}
          onOpenChange={(open) => !open && onCloseCodeDialog()}
        >
          <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md">
            <button
              onClick={onCloseCodeDialog}
              className="absolute right-6 top-6 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>

            <AlertDialogHeader className="text-center">
              <AlertDialogTitle className="text-lg sm:text-xl">
                {showCodeDialog.child.name}'s Login Code
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                Share this code or QR code with your child to log in
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="grid gap-4">
              <div className="bg-muted p-3 sm:p-4 rounded-lg text-center">
                <p className="text-xs text-muted-foreground mb-2">
                  Login Code
                </p>
                <p className="text-2xl sm:text-3xl font-mono font-bold break-all">
                  {getFullLoginCode(showCodeDialog.child)}
                </p>
              </div>

              <div className="flex justify-center">
                <QRCodeDisplay
                  child={showCodeDialog.child}
                  getFullLoginCode={getFullLoginCode}
                  fetchFamilyCode={fetchFamilyCode}
                  isRefreshing={isRefreshingFamilyCode}
                  onRetry={() => {
                    setIsRefreshingFamilyCode(false);
                  }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Button
                  onClick={() =>
                    onCopyCode(getFullLoginCode(showCodeDialog.child))
                  }
                  variant="outline"
                  className="w-full"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Code
                </Button>
                <Button
                  onClick={() => onCopyMagicLink(showCodeDialog.child)}
                  variant="outline"
                  className="w-full"
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
                <Button
                  onClick={() => onPrintCode(showCodeDialog.child)}
                  variant="outline"
                  className="w-full"
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </Button>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-center sm:space-x-2">
              <AlertDialogCancel className="w-full sm:w-auto sm:min-w-[120px] mt-2 sm:mt-0">
                Close
              </AlertDialogCancel>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* Edit Login Code Confirmation Dialog */}
      <AlertDialog
        open={!!childToEditCode}
        onOpenChange={(open) => !open && onCloseEditCode()}
      >
        <AlertDialogContent>
          <button
            onClick={onCloseEditCode}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
            disabled={isUpdatingCode}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>Generate New Login Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to generate a new login code for{" "}
              {childToEditCode?.name}? The current code (
              {childToEditCode?.login_code}) will no longer work. Make sure to
              share the new code with your child.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingCode}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={onUpdateLoginCode}
              disabled={isUpdatingCode}
            >
              {isUpdatingCode ? "Generating..." : "Generate New Code"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Child Confirmation Dialog */}
      <AlertDialog
        open={!!childToDelete}
        onOpenChange={(open) => !open && onCloseDelete()}
      >
        <AlertDialogContent>
          <button
            onClick={onCloseDelete}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Child</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {childToDelete?.name}? This
              action cannot be undone and will delete all associated data
              including messages and call history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDeleteChild}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print View Modal (Mobile) */}
      {printViewChild && (
        <AlertDialog
          open={!!printViewChild}
          onOpenChange={(open) => !open && onClosePrintView()}
        >
          <AlertDialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md print:hidden">
            <button
              onClick={onClosePrintView}
              className="absolute right-6 top-6 z-10 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none print:hidden"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Close</span>
            </button>

            <AlertDialogHeader className="text-center">
              <AlertDialogTitle className="text-lg sm:text-xl">
                {printViewChild.name}'s Login Code
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                Print or share this code with your child
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="grid gap-4">
              <div className="bg-muted p-3 sm:p-4 rounded-lg print:border-2 print:border-gray-800 text-center">
                <p className="text-xs text-muted-foreground mb-2 print:text-gray-600">
                  Login Code
                </p>
                <p className="text-2xl sm:text-3xl font-mono font-bold break-all print:text-3xl">
                  {getFullLoginCode(printViewChild)}
                </p>
              </div>

              <div className="flex justify-center print:my-4">
                <QRCodeDisplay
                  child={printViewChild}
                  getFullLoginCode={getFullLoginCode}
                  fetchFamilyCode={fetchFamilyCode}
                  isRefreshing={isRefreshingFamilyCode}
                  onRetry={() => {
                    setIsRefreshingFamilyCode(false);
                  }}
                  size="large"
                />
              </div>

              <div className="instructions print:mt-4 print:text-sm print:text-gray-600 text-center">
                <p>Scan the QR code or use the code above to log in</p>
                <p>Visit: {window.location.origin}/child/login</p>
              </div>
            </div>

            <div className="print:hidden flex flex-col-reverse sm:flex-row sm:justify-center sm:space-x-2">
              <Button
                onClick={onPrintFromModal}
                variant="default"
                className="w-full sm:w-auto sm:min-w-[120px]"
              >
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
              <AlertDialogCancel className="w-full sm:w-auto sm:min-w-[120px] mt-2 sm:mt-0">
                Close
              </AlertDialogCancel>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
};

