// src/pages/HomePage/FounderStorySection.tsx
// Personal founder story from a dad

export const FounderStorySection = () => {
  return (
    <section className="py-12 md:py-16 bg-muted/20" aria-labelledby="founder-heading">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl mx-auto">
          <h2
            id="founder-heading"
            className="text-2xl md:text-3xl font-bold text-center mb-6 md:mb-8"
          >
            Why I built KidsCallHome
          </h2>

          <div className="space-y-4 text-base md:text-lg text-muted-foreground leading-relaxed">
            <p>
              I built KidsCallHome for my 4 young kids. Like many families, we found ourselves in a situation where the kids had tablets but every call still depended on an adult&apos;s phone being available.
            </p>
            <p>
              My kids were living between homes, traveling with grandparents, or just wanting to say goodnight — and those simple calls were turning into a hassle. I wanted them to be able to call family independently, without handing them a full social app with feeds, friend requests, and all the noise that comes with it.
            </p>
            <p>
              So I built something simple: a way for kids to see who in the family is available and tap to call. No passwords to remember, no public profiles, no strangers. Just family.
            </p>
            <p className="text-foreground font-medium italic pt-4">
              If this helps your family the way it helps mine, then it&apos;s doing its job.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

