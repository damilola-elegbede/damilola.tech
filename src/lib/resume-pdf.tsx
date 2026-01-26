'use client';

/**
 * ATS-friendly resume PDF generator using @react-pdf/renderer.
 *
 * Creates native text-based PDFs (not image-based) that ATS systems can parse.
 * Design matches the original Damilola Elegbede resume format:
 * - Helvetica font (similar to Helvetica Neue)
 * - Black text on white background
 * - Clean, single-column layout
 * - Professional, minimal styling
 *
 * IMPORTANT: This module must be dynamically imported in Next.js to avoid
 * SSR issues with @react-pdf/renderer. See GitHub issues #3156 and #1737.
 */

import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
  Link,
} from '@react-pdf/renderer';
import type { ResumeAnalysisResult, ProposedChange } from '@/lib/types/resume-generation';

// Resume data structure (matches resume-full.json)
export interface ResumeData {
  name: string;
  title: string;
  phone: string;
  email: string;
  linkedin: string;
  website: string;
  location: string;
  tagline: string;
  summary: string;
  experience: {
    company: string;
    title: string;
    location: string;
    dates: string;
    description: string;
    responsibilities: string[];
  }[];
  education: {
    degree: string;
    institution: string;
    year: number;
    focus: string;
  }[];
  skills: {
    leadership: string[];
    cloud: string[];
    systemArchitecture: string[];
    devex: string[];
    programming: string[];
    domain: string[];
  };
}

// Styles matching the original resume design exactly
const styles = StyleSheet.create({
  page: {
    padding: 50,
    paddingTop: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.3,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  // Header section
  header: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    paddingBottom: 10,
  },
  name: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  contactRow: {
    fontSize: 9,
    textAlign: 'center',
    marginTop: 3,
    color: '#000000',
  },
  contactLink: {
    color: '#0066cc',
    textDecoration: 'none',
  },
  roleTitle: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 10,
  },
  tagline: {
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 4,
  },
  // Section headers - centered, no border
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 14,
    marginBottom: 8,
  },
  // Summary
  summary: {
    fontSize: 10,
    lineHeight: 1.4,
    marginBottom: 4,
    textAlign: 'justify',
  },
  // Experience section - Company | Location first, then Title (Dates)
  job: {
    marginBottom: 10,
  },
  jobCompanyLine: {
    flexDirection: 'row',
    marginBottom: 1,
  },
  companyBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  companyLocation: {
    fontSize: 10,
  },
  jobTitleLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  jobTitleBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  jobDates: {
    fontSize: 10,
  },
  jobDescription: {
    fontSize: 10,
    marginBottom: 3,
    lineHeight: 1.3,
  },
  // Bullets with ● character
  bulletContainer: {
    flexDirection: 'row',
    marginLeft: 12,
    marginBottom: 2,
  },
  bullet: {
    width: 12,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.3,
  },
  // Education section - multi-line format
  educationEntry: {
    marginBottom: 6,
  },
  degreeLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  degreeBold: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  institution: {
    fontSize: 10,
  },
  focusLine: {
    fontSize: 10,
    fontStyle: 'italic',
  },
  year: {
    fontSize: 10,
  },
  // Skills section
  skillCategory: {
    marginBottom: 3,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  skillLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 10,
  },
  skillList: {
    fontSize: 10,
  },
  // Footer note (hidden in production, useful for debugging)
  footer: {
    marginTop: 16,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#cccccc',
    borderStyle: 'dashed',
    fontSize: 8,
    color: '#999999',
  },
});

interface ResumePDFProps {
  data: ResumeData;
  analysis: ResumeAnalysisResult;
  acceptedIndices: Set<number>;
  showFooter?: boolean;
}

/**
 * Apply accepted changes to resume content
 */
function applyChanges(
  resume: ResumeData,
  changes: ProposedChange[],
  acceptedIndices: Set<number>
): ResumeData {
  const result = JSON.parse(JSON.stringify(resume)) as ResumeData;

  changes.forEach((change, index) => {
    if (!acceptedIndices.has(index)) return;

    if (change.section === 'summary') {
      result.summary = change.modified;
    } else if (change.section.startsWith('experience.')) {
      // Parse section like "experience.verily.bullet1"
      const parts = change.section.split('.');
      if (parts.length >= 3) {
        const companyKey = parts[1].toLowerCase();
        const bulletMatch = parts[2].match(/bullet(\d+)/);

        const expIndex = result.experience.findIndex(
          (exp) => exp.company.toLowerCase().includes(companyKey)
        );

        if (expIndex >= 0 && bulletMatch) {
          const bulletIndex = parseInt(bulletMatch[1], 10) - 1;
          if (bulletIndex >= 0 && bulletIndex < result.experience[expIndex].responsibilities.length) {
            result.experience[expIndex].responsibilities[bulletIndex] = change.modified;
          }
        }
      }
    }
  });

  return result;
}

/**
 * Expand degree abbreviations to full names
 */
function expandDegree(degree: string): string {
  const expansions: Record<string, string> = {
    'MBA': 'Master of Business Administration (MBA)',
    'MS, Computer Science': 'Master of Science (MS), Computer Science',
    'BS, Electrical & Computer Engineering': 'Bachelor of Science (BS), Electrical & Computer Engineering',
  };
  return expansions[degree] || degree;
}

/**
 * React PDF Document component for the resume
 * Format matches original resume exactly:
 * - Name: ALL CAPS, centered, bold
 * - Title: Separate line, centered, bold
 * - Tagline: Italicized
 * - Contact: Two lines - phone|email|location and full URLs
 * - Section headers: Centered, no border
 * - Experience: Company|Location first, then Title (Dates)
 * - Bullets: ● character
 * - Education: Multi-line format
 * - Skills: "KEY SKILLS" title
 */
function ResumePDF({ data, analysis, acceptedIndices, showFooter = false }: ResumePDFProps) {
  const resume = applyChanges(data, analysis.proposedChanges, acceptedIndices);
  const acceptedChanges = analysis.proposedChanges.filter((_, i) => acceptedIndices.has(i));

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.name}>{resume.name.toUpperCase()}</Text>
          <Text style={styles.contactRow}>
            {resume.phone} | {resume.email} | {resume.location}
          </Text>
          <Text style={styles.contactRow}>
            <Link src={resume.linkedin} style={styles.contactLink}>
              {resume.linkedin}
            </Link>
            {resume.website && (
              <>
                {' | '}
                <Link src={resume.website} style={styles.contactLink}>
                  {resume.website}
                </Link>
              </>
            )}
          </Text>
          <Text style={styles.roleTitle}>{resume.title.toUpperCase()}</Text>
          {resume.tagline && <Text style={styles.tagline}>{resume.tagline}</Text>}
        </View>

        {/* Professional Summary */}
        <Text style={styles.sectionHeader}>Professional Summary</Text>
        <Text style={styles.summary}>{resume.summary}</Text>

        {/* Professional Experience */}
        <Text style={styles.sectionHeader}>Professional Experience</Text>
        {resume.experience.map((job, jobIndex) => (
          <View key={jobIndex} style={styles.job} wrap={false}>
            {/* Company | Location */}
            <View style={styles.jobCompanyLine}>
              <Text style={styles.companyBold}>{job.company}</Text>
              <Text style={styles.companyLocation}> | {job.location}</Text>
            </View>
            {/* Title (Dates) */}
            <View style={styles.jobTitleLine}>
              <Text style={styles.jobTitleBold}>{job.title}</Text>
              <Text style={styles.jobDates}>({job.dates})</Text>
            </View>
            {/* Description paragraph */}
            {job.description && (
              <Text style={styles.jobDescription}>{job.description}</Text>
            )}
            {/* Bullets */}
            {job.responsibilities.map((responsibility, bulletIndex) => (
              <View key={bulletIndex} style={styles.bulletContainer}>
                <Text style={styles.bullet}>●</Text>
                <Text style={styles.bulletText}>{responsibility}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* Education - Multi-line format */}
        <Text style={styles.sectionHeader}>Education</Text>
        {resume.education.map((edu, eduIndex) => (
          <View key={eduIndex} style={styles.educationEntry}>
            <View style={styles.degreeLine}>
              <Text style={styles.degreeBold}>{expandDegree(edu.degree)}</Text>
              <Text style={styles.year}>{edu.year}</Text>
            </View>
            <Text style={styles.institution}>{edu.institution}</Text>
            {edu.focus && <Text style={styles.focusLine}>Focus: {edu.focus}</Text>}
          </View>
        ))}

        {/* Key Skills - changed from Core Competencies */}
        <Text style={styles.sectionHeader}>Key Skills</Text>
        <View style={styles.skillCategory}>
          <Text style={styles.skillLabel}>Leadership: </Text>
          <Text style={styles.skillList}>{resume.skills.leadership.join(' | ')}</Text>
        </View>
        <View style={styles.skillCategory}>
          <Text style={styles.skillLabel}>Cloud & Infrastructure: </Text>
          <Text style={styles.skillList}>{resume.skills.cloud.join(' | ')}</Text>
        </View>
        <View style={styles.skillCategory}>
          <Text style={styles.skillLabel}>Technical: </Text>
          <Text style={styles.skillList}>
            {[
              ...resume.skills.systemArchitecture.slice(0, 4),
              ...resume.skills.devex.slice(0, 3),
            ].join(' | ')}
          </Text>
        </View>
        <View style={styles.skillCategory}>
          <Text style={styles.skillLabel}>Programming: </Text>
          <Text style={styles.skillList}>{resume.skills.programming.join(' | ')}</Text>
        </View>

        {/* Footer (optional) */}
        {showFooter && (
          <View style={styles.footer}>
            <Text>
              ATS Optimized for: {analysis.analysis.roleTitle} at {analysis.analysis.companyName} |
              Compatibility Score: {analysis.optimizedScore.total}/100 |
              Changes Applied: {acceptedChanges.length} |
              Generated: {new Date().toLocaleDateString()}
            </Text>
          </View>
        )}
      </Page>
    </Document>
  );
}

/**
 * Generate a PDF blob from resume data and analysis results
 */
export async function generateResumePdf(
  data: ResumeData,
  analysis: ResumeAnalysisResult,
  acceptedIndices: Set<number>
): Promise<Blob> {
  const pdfDocument = <ResumePDF data={data} analysis={analysis} acceptedIndices={acceptedIndices} />;
  const blob = await pdf(pdfDocument).toBlob();
  return blob;
}

/**
 * Get the filename for the generated resume
 */
export function getResumeFilename(companyName: string, roleTitle: string): string {
  const sanitize = (str: string) => str.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-');
  return `${sanitize(companyName)}-${sanitize(roleTitle)}.pdf`;
}
