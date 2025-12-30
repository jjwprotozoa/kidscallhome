// src/components/info/AboutMissionSection.tsx
// Purpose: Distinct "About" and "Mission" section for Info page
// This provides unique content not duplicated on the homepage

import { Card } from "@/components/ui/card";
import { Heart, Shield, Users } from "lucide-react";

export const AboutMissionSection = () => {
  return (
    <section id="about" className="mb-8 scroll-mt-20">
      <Card className="p-6">
        <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
          <Heart className="h-5 w-5" />
          Why Kids Call Home Exists
        </h2>
        
        <div className="space-y-6">
          <div>
            <h3 className="font-semibold mb-3 text-lg">Our Mission</h3>
            <p className="text-muted-foreground leading-relaxed">
              Kids Call Home was built by a long-distance parent who experienced the 
              heartache of missing bedtime calls and daily moments with his children. 
              After trying countless apps that either required phone numbers, exposed 
              kids to strangers, or buried family communication under ads and games, 
              he built a solution focused on one thing: <strong>real, safe connection 
              between kids and their families.</strong>
            </p>
          </div>

          <div>
            <h3 className="font-semibold mb-3 text-lg">The Problem We Solve</h3>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Most communication apps aren't designed for kids. They require phone numbers 
              (which kids' tablets don't have), expose children to strangers through 
              search features, or distract with ads and games. Parents face a difficult 
              choice: give kids a phone they're not ready for, or accept that staying 
              connected is complicated.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Kids Call Home solves this by being <strong>designed from the ground up 
              for family-only communication</strong>—no phone numbers needed, no strangers 
              possible, no distractions from what matters: talking to family.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-4 pt-4">
            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-primary/5">
              <Shield className="h-8 w-8 text-primary mb-2" />
              <h4 className="font-semibold mb-2">Safety First</h4>
              <p className="text-sm text-muted-foreground">
                Every design decision prioritizes your child's safety and privacy
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-primary/5">
              <Users className="h-8 w-8 text-primary mb-2" />
              <h4 className="font-semibold mb-2">Family Focused</h4>
              <p className="text-sm text-muted-foreground">
                Built for real families dealing with co-parenting, distance, and busy lives
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-4 rounded-lg bg-primary/5">
              <Heart className="h-8 w-8 text-primary mb-2" />
              <h4 className="font-semibold mb-2">Parent Peace of Mind</h4>
              <p className="text-sm text-muted-foreground">
                You control who your child can contact—no exceptions, no surprises
              </p>
            </div>
          </div>
        </div>
      </Card>
    </section>
  );
};



