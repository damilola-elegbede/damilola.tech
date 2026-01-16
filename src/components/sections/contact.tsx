import { SocialLinks } from '@/components/ui';
import { resumeData } from '@/lib/resume-data';

export function Contact() {
  return (
    <footer
      id="contact"
      className="border-t border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-16"
    >
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="mb-8 text-[var(--color-text)]">Let&apos;s Connect</h2>

        {/* Social Links */}
        <SocialLinks className="mb-8 justify-center" iconSize="lg" />

        {/* Location */}
        <p className="text-[var(--color-text-muted)]">{resumeData.location}</p>
      </div>
    </footer>
  );
}
