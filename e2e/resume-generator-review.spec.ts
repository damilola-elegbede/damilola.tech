import { test, expect, type Page } from '@playwright/test';

/**
 * Deterministic mock response for the resume generator API.
 * Eliminates AI dependency — tests exercise the full UI review workflow
 * against a fixed response shape.
 */
const MOCK_METADATA = {
  wasUrl: false,
  deterministicScore: {
    total: 72,
    breakdown: {
      roleRelevance: 20,
      claritySkimmability: 22,
      businessImpact: 18,
      presentationQuality: 12,
    },
    matchedKeywords: ['engineering', 'manager', 'cloud', 'gcp', 'leadership'],
    missingKeywords: ['aws', 'communication'],
    matchRate: 71.4,
    keywordDensity: 2.3,
  },
};

const MOCK_ANALYSIS = {
  analysis: {
    jdSummary: 'Software Engineering Manager role requiring cloud and leadership experience',
    companyName: 'Test Company Inc.',
    roleTitle: 'Software Engineering Manager',
    department: 'Engineering',
    topKeywords: ['engineering', 'manager', 'cloud', 'aws', 'gcp', 'leadership', 'communication'],
    requiredSkills: ['cloud platforms', 'team leadership', 'software development'],
    niceToHaveSkills: ['communication skills'],
    yearsRequired: '5+',
    teamSize: 'Not specified',
    scopeExpected: 'Engineering team',
    industryContext: 'Technology',
  },
  currentScore: {
    total: 72,
    breakdown: {
      roleRelevance: 20,
      claritySkimmability: 22,
      businessImpact: 18,
      presentationQuality: 12,
    },
    assessment: 'Strong presentation with minor refinement opportunities',
  },
  proposedChanges: [
    {
      section: 'summary',
      original: 'Strategic engineering leader with 15+ years of experience',
      modified: 'Cloud-focused engineering leader with 15+ years scaling infrastructure teams',
      reason: 'Frontloaded cloud and infrastructure keywords to match JD emphasis',
      relevanceSignals: ['cloud', 'infrastructure', 'engineering leader'],
      impactPoints: 4,
      impactPerSignal: 1.3,
    },
    {
      section: 'experience.verily.bullet1',
      original: 'Architected and executed enterprise-wide GCP cloud transformation',
      modified: 'Led enterprise-wide GCP cloud transformation supporting 30+ production systems, reducing deployment time by 60%',
      reason: 'Added quantified business impact and led with action verb from JD',
      relevanceSignals: ['led', 'cloud'],
      impactPoints: 3,
      impactPerSignal: 1.5,
    },
    {
      section: 'skills.cloud',
      original: 'GCP, AWS',
      modified: 'Google Cloud Platform (GCP), Amazon Web Services (AWS), Kubernetes, Docker',
      reason: 'Expanded cloud skills with both acronyms and full names for recruiter findability',
      relevanceSignals: ['kubernetes', 'docker', 'aws'],
      impactPoints: 5,
      impactPerSignal: 1.7,
    },
  ],
  optimizedScore: {
    total: 84,
    breakdown: {
      roleRelevance: 26,
      claritySkimmability: 25,
      businessImpact: 21,
      presentationQuality: 12,
    },
    assessment: 'Strong presentation with minor refinement opportunities',
  },
  gaps: [
    {
      requirement: 'Communication skills emphasis',
      severity: 'minor',
      inResume: false,
      mitigation: 'Add communication examples from cross-functional leadership experience',
    },
  ],
  skillsReorder: {
    before: ['Leadership', 'Cloud', 'DevOps'],
    after: ['Cloud', 'Leadership', 'DevOps'],
    reason: 'Prioritized cloud skills to match JD emphasis',
  },
  interviewPrep: [
    'Prepare examples of AWS experience alongside GCP',
    'Have specific metrics ready for cloud migration impact',
  ],
  scoreCeiling: {
    maximum: 84,
    blockers: ['No explicit AWS project experience in sources'],
    toImprove: 'Adding AWS project work would improve cloud skills coverage',
  },
};

/**
 * Build the streaming response body: metadata JSON on first line, then analysis JSON.
 */
function buildMockResponseBody(): string {
  return JSON.stringify(MOCK_METADATA) + '\n' + JSON.stringify(MOCK_ANALYSIS);
}

/**
 * Intercept the resume generator API with a deterministic mock response.
 * Returns instantly — no AI call, no timeout risk.
 */
async function mockResumeGeneratorApi(page: Page) {
  await page.route('**/api/resume-generator', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 200,
        contentType: 'text/plain; charset=utf-8',
        body: buildMockResponseBody(),
      });
    } else {
      route.continue();
    }
  });
}

/**
 * E2E tests for the Resume Generator review workflow.
 * Tests the interactive change review flow: analyze → review → edit → generate.
 *
 * Uses route interception to mock the AI response — tests are deterministic
 * and complete in seconds, not minutes.
 */
test.describe('Resume Generator Review Workflow', () => {
  test.describe.configure({ timeout: 30_000 });

  test.beforeEach(async ({ page }) => {
    const password = process.env.ADMIN_PASSWORD_PREVIEW;
    if (!password) {
      test.skip();
      return;
    }

    // Login to admin
    await page.goto('/admin/login');
    await page.getByLabel('Password').fill(password);
    await Promise.all([
      page.waitForResponse((resp) => resp.url().includes('/api/admin/auth')),
      page.getByRole('button', { name: 'Sign In' }).click(),
    ]);
    await expect(page).toHaveURL('/admin/dashboard');

    // Mock the AI API before navigating to the page
    await mockResumeGeneratorApi(page);

    // Navigate to resume generator
    await page.goto('/admin/resume-generator');
    await expect(page.getByRole('heading', { name: 'Resume Generator' })).toBeVisible();
  });

  test('shows changes as pending after analysis (not auto-accepted)', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Resume Generator' })).toBeVisible();
    await expect(page.getByPlaceholder(/paste.*job description/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /analyze/i })).toBeVisible();
  });

  test('UI shows edit and reject options for pending changes', async ({ page }) => {
    const jdTextarea = page.getByPlaceholder(/paste.*job description/i);
    await jdTextarea.fill(`
      Software Engineering Manager
      Company: Test Company Inc.
      Requirements:
      - 5+ years of software development experience
      - 3+ years leading engineering teams
      - Experience with cloud platforms (AWS, GCP)
      - Strong communication skills
    `);

    await page.getByRole('button', { name: /analyze/i }).click();

    // Mock responds instantly — no 60s timeout needed
    await expect(page.getByText(/Proposed Changes/i)).toBeVisible({ timeout: 10000 });

    // Verify changes are shown as pending with all action buttons
    await expect(page.getByRole('button', { name: /^accept$/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /edit & accept/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^reject$/i }).first()).toBeVisible();
  });

  test('can enter edit mode and modify change text', async ({ page }) => {
    const jdTextarea = page.getByPlaceholder(/paste.*job description/i);
    await jdTextarea.fill(`
      Software Engineering Manager
      Company: Test Company Inc.
      Requirements:
      - 5+ years experience
      - Leadership skills
    `);

    await page.getByRole('button', { name: /analyze/i }).click();
    await expect(page.getByText(/Proposed Changes/i)).toBeVisible({ timeout: 10000 });

    // Click Edit & Accept on first change
    await page.getByRole('button', { name: /edit & accept/i }).first().click();

    // Verify edit mode is active
    const editTextarea = page.getByLabel(/edit.*change/i);
    await expect(editTextarea).toBeVisible();
    await expect(page.getByRole('button', { name: /save & accept/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /cancel/i })).toBeVisible();

    // Modify the text
    await editTextarea.clear();
    await editTextarea.fill('My custom edited text for this change');

    // Save and accept
    await page.getByRole('button', { name: /save & accept/i }).click();

    // Verify change is now accepted with "Edited" badge
    await expect(page.getByText('Accepted').first()).toBeVisible();
    await expect(page.locator('span:text-is("Edited")').first()).toBeVisible();
  });

  test('can reject change with optional feedback', async ({ page }) => {
    const jdTextarea = page.getByPlaceholder(/paste.*job description/i);
    await jdTextarea.fill(`
      Software Engineering Manager
      Company: Test Company Inc.
      Requirements:
      - 5+ years experience
    `);

    await page.getByRole('button', { name: /analyze/i }).click();
    await expect(page.getByText(/Proposed Changes/i)).toBeVisible({ timeout: 10000 });

    // Click Reject on first change
    await page.getByRole('button', { name: /^reject$/i }).first().click();

    // Verify feedback input appears
    await expect(page.getByPlaceholder(/optional feedback/i)).toBeVisible();

    // Enter feedback
    await page.getByPlaceholder(/optional feedback/i).fill('Too aggressive for this role');

    // Confirm rejection
    await page.getByRole('button', { name: /confirm reject/i }).click();

    // Verify change is now rejected with feedback shown
    await expect(page.getByText('Rejected').first()).toBeVisible();
    await expect(page.getByText(/too aggressive for this role/i)).toBeVisible();
  });

  test('can revert decision back to pending', async ({ page }) => {
    const jdTextarea = page.getByPlaceholder(/paste.*job description/i);
    await jdTextarea.fill(`
      Software Engineering Manager
      Company: Test Company Inc.
      Requirements:
      - 5+ years experience
    `);

    await page.getByRole('button', { name: /analyze/i }).click();
    await expect(page.getByText(/Proposed Changes/i)).toBeVisible({ timeout: 10000 });

    // Accept a change first
    await page.getByRole('button', { name: /^accept$/i }).first().click();
    await expect(page.getByText('Accepted').first()).toBeVisible();

    // Now revert it
    await page.getByRole('button', { name: /revert to pending/i }).click();

    // Verify change is back to pending (has Accept/Reject buttons)
    await expect(page.getByRole('button', { name: /^accept$/i }).first()).toBeVisible();
  });

  test('bulk accept all pending changes', async ({ page }) => {
    const jdTextarea = page.getByPlaceholder(/paste.*job description/i);
    await jdTextarea.fill(`
      Software Engineering Manager at Test Company
      Requirements:
      - 5+ years experience
      - Cloud platforms
    `);

    await page.getByRole('button', { name: /analyze/i }).click();
    await expect(page.getByText(/Proposed Changes/i)).toBeVisible({ timeout: 10000 });

    // Click Accept All Pending
    await page.getByRole('button', { name: /accept all pending/i }).click();

    // Verify all changes show as Accepted
    const acceptedBadges = page.getByText('Accepted');
    await expect(acceptedBadges.first()).toBeVisible();

    // No more Accept buttons should be visible for individual changes
    await expect(page.getByRole('button', { name: /accept all pending/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /^accept$/i })).toHaveCount(0);
  });

  test('generate PDF button disabled when no changes accepted', async ({ page }) => {
    const jdTextarea = page.getByPlaceholder(/paste.*job description/i);
    await jdTextarea.fill(`
      Software Engineering Manager
      Company: Test Company
      Requirements:
      - Experience
    `);

    await page.getByRole('button', { name: /analyze/i }).click();
    await expect(page.getByText(/Proposed Changes/i)).toBeVisible({ timeout: 10000 });

    // Generate PDF button should be disabled when no changes are accepted
    const generateButton = page.getByRole('button', { name: /generate pdf/i }).first();
    await expect(generateButton).toBeDisabled();

    // Accept a change
    await page.getByRole('button', { name: /^accept$/i }).first().click();

    // Now generate button should be enabled
    await expect(generateButton).toBeEnabled();
  });
});
