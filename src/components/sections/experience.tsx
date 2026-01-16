'use client';

import { resumeData } from '@/lib/resume-data';
import { ExperienceCard } from './experience-card';

export function Experience() {
  return (
    <section id="experience" className="px-6 py-20">
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-12 text-3xl text-[var(--color-text)] md:text-4xl">
          Experience
        </h2>
        <div className="space-y-6">
          {resumeData.experiences.map((exp) => (
            <ExperienceCard key={exp.id} experience={exp} />
          ))}
        </div>
      </div>
    </section>
  );
}
