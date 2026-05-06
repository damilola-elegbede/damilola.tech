import { Document, Page, Text, View, StyleSheet, renderToBuffer } from '@react-pdf/renderer';
import { resumeData } from '@/lib/resume-data';

export const runtime = 'nodejs';

const styles = StyleSheet.create({
  page: {
    padding: 45,
    paddingTop: 35,
    fontFamily: 'Helvetica',
    fontSize: 10,
    lineHeight: 1.2,
    color: '#000000',
    backgroundColor: '#ffffff',
  },
  name: {
    fontSize: 18,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  title: {
    fontSize: 13,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 10,
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 6,
  },
  contactRow: {
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#000000',
    marginTop: 6,
    marginBottom: 8,
  },
  brandingStatement: {
    fontSize: 10,
    lineHeight: 1.3,
    textAlign: 'justify',
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 11,
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: 10,
    marginBottom: 6,
  },
  job: {
    marginBottom: 8,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 1,
  },
  companyTitle: {
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    fontSize: 10,
    flex: 1,
  },
  jobDates: {
    fontSize: 10,
  },
  jobLocation: {
    fontStyle: 'italic',
    fontSize: 10,
    marginBottom: 3,
  },
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
    lineHeight: 1.2,
  },
  skillRow: {
    marginBottom: 3,
  },
  educationEntry: {
    marginBottom: 5,
  },
  degreeBold: {
    fontFamily: 'Helvetica',
    fontWeight: 'bold',
    fontSize: 10,
  },
  institution: {
    fontSize: 10,
  },
});

function ResumePdf() {
  const data = resumeData;
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.name}>{data.name}</Text>
        <Text style={styles.title}>{data.title}</Text>
        {data.tagline ? <Text style={styles.tagline}>{data.tagline}</Text> : null}
        <Text style={styles.contactRow}>
          {data.email} | {data.location}
        </Text>
        <Text style={styles.contactRow}>
          {data.linkedin} | {data.github}
        </Text>
        <View style={styles.divider} />

        {data.brandingStatement ? (
          <Text style={styles.brandingStatement}>{data.brandingStatement}</Text>
        ) : null}

        <Text style={styles.sectionHeader}>Professional Experience</Text>
        {data.experiences.map((exp) => (
          <View key={exp.id} style={styles.job} minPresenceAhead={20}>
            <View style={styles.jobHeader}>
              <Text style={styles.companyTitle}>{exp.company} — {exp.title}</Text>
              <Text style={styles.jobDates}>{exp.startDate} – {exp.endDate}</Text>
            </View>
            <Text style={styles.jobLocation}>{exp.location}</Text>
            {exp.highlights.map((highlight, i) => (
              <View key={i} style={styles.bulletContainer} wrap={false}>
                <Text style={styles.bullet}>•</Text>
                <Text style={styles.bulletText}>{highlight}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.sectionHeader}>Key Skills</Text>
        {data.skills.map((skill, i) => (
          <View key={i} style={styles.skillRow}>
            <Text>
              <Text style={styles.degreeBold}>{skill.category}: </Text>
              <Text>{skill.items.join(' | ')}</Text>
            </Text>
          </View>
        ))}

        <Text style={styles.sectionHeader}>Education</Text>
        {data.education.map((edu) => (
          <View key={edu.id} style={styles.educationEntry}>
            <Text style={styles.degreeBold}>{edu.degree}</Text>
            <Text style={styles.institution}>{edu.institution}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

export async function GET() {
  try {
    const buffer = await renderToBuffer(<ResumePdf />);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="damilola-elegbede-resume.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[api/v1/resume.pdf] PDF generation failed:', error);
    return new Response(
      JSON.stringify({ success: false, error: { code: 'INTERNAL_ERROR', message: 'PDF generation failed' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
