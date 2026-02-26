import { RESUME_GENERATOR_PROMPT } from '@/lib/generated/system-prompt';
import { fetchAllContent, fetchResumeGeneratorInstructionsRequired } from '@/lib/blob';

const isGeneratedPromptAvailable = RESUME_GENERATOR_PROMPT !== '__DEVELOPMENT_PLACEHOLDER__';

export async function getResumeGeneratorPrompt(): Promise<string> {
  if (isGeneratedPromptAvailable) {
    return RESUME_GENERATOR_PROMPT;
  }

  const [instructions, content] = await Promise.all([
    fetchResumeGeneratorInstructionsRequired(),
    fetchAllContent(),
  ]);

  let prompt = instructions;
  const replacements: Record<string, string> = {
    '{{RESUME_FULL}}': content.resume || '*Resume content not available.*',
    '{{STAR_STORIES}}': content.starStories || '*STAR stories not available.*',
    '{{LEADERSHIP_PHILOSOPHY}}': content.leadershipPhilosophy || '*Leadership philosophy not available.*',
    '{{TECHNICAL_EXPERTISE}}': content.technicalExpertise || '*Technical expertise not available.*',
    '{{VERILY_FEEDBACK}}': content.verilyFeedback || '*Performance feedback not available.*',
    '{{PROJECTS_CONTEXT}}': content.projectsContext || '*Projects context not available.*',
    '{{ANECDOTES}}': content.anecdotes || '*Anecdotes not available.*',
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    prompt = prompt.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), () => value);
  }

  return prompt;
}
