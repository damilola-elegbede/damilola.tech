'use client';

import { useState } from 'react';
import { resumeData } from '@/lib/resume-data';
import { ExperienceCard } from './experience-card';

export function Experience() {
  const [showAll, setShowAll] = useState(false);
  const displayedExperiences = showAll
    ? resumeData.experiences
    : resumeData.experiences.slice(0, 3);

  return (
    <section id="experience" className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-12 text-3xl text-[var(--color-text)] md:text-4xl">
          Experience
        </h2>
        <div className="space-y-6">
          {displayedExperiences.map((exp) => (
            <ExperienceCard key={exp.id} experience={exp} />
          ))}
        </div>

        {/* Expand Button */}
        {resumeData.experiences.length > 3 && !showAll && (
          <button
            onClick={() => setShowAll(true)}
            className="mt-6 w-full py-3 text-center text-[var(--color-accent)] transition-colors hover:underline"
          >
            Show {resumeData.experiences.length - 3} more position{resumeData.experiences.length - 3 > 1 ? 's' : ''}
          </button>
        )}

        {/* Collapse Button */}
        {showAll && resumeData.experiences.length > 3 && (
          <button
            onClick={() => setShowAll(false)}
            className="mt-6 w-full py-3 text-center text-[var(--color-accent)] transition-colors hover:underline"
          >
            Show less
          </button>
        )}
      </div>
    </section>
  );
}
