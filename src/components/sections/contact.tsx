import { SocialLinks } from '@/components/ui';
import { resumeData } from '@/lib/resume-data';

export function Contact() {
  return (
    <footer
      id="contact"
      className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-16"
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="mb-8 text-3xl text-[var(--color-text)] md:text-4xl">Let&apos;s Connect</h2>

        {/* Social Links */}
        <SocialLinks className="mb-8 justify-center" iconSize="lg" />

        {/* Location */}
        <p className="text-[var(--color-text-muted)]">{resumeData.location}</p>
      </div>
    </footer>
  );
}
