/**
 * GitHub Service - integration with GitHub API for release management
 */

export interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | null;
  html_url: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  html_url: string;
  created_at: string;
  published_at: string | null;
}

export class GitHubService {
  private readonly token: string;
  private readonly owner: string;
  private readonly repo: string;
  private readonly apiBase: string;

  constructor() {
    this.token = process.env.GITHUB_TOKEN || '';
    this.owner = process.env.GITHUB_OWNER || '';
    this.repo = process.env.GITHUB_REPO || '';
    this.apiBase = 'https://api.github.com';
  }

  /**
   * Check if GitHub integration is configured
   */
  isConfigured(): boolean {
    return !!(this.token && this.owner && this.repo);
  }

  /**
   * Trigger GitHub Actions workflow dispatch
   */
  async triggerWorkflow(workflowFileName: string, ref: string, inputs: Record<string, string>): Promise<GitHubWorkflowRun> {
    if (!this.isConfigured()) {
      throw new Error('GitHub integration not configured. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO environment variables.');
    }

    // GitHub API accepts workflow file name (e.g., "release.yml") or workflow ID
    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/actions/workflows/${workflowFileName}/dispatches`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref,
        inputs,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to trigger workflow: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // GitHub API doesn't return the run ID immediately in the response
    // We need to poll for the latest workflow run
    // Wait a bit for GitHub to create the run
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const workflowRuns = await this.getWorkflowRuns(workflowFileName, 1);
    if (workflowRuns.length > 0) {
      return workflowRuns[0];
    }

    // Fallback: return a placeholder
    return {
      id: Date.now(),
      name: workflowFileName,
      status: 'queued',
      conclusion: null,
      html_url: `https://github.com/${this.owner}/${this.repo}/actions`,
    };
  }

  /**
   * Get workflow runs for a specific workflow
   */
  async getWorkflowRuns(workflowId: string, limit: number = 10): Promise<GitHubWorkflowRun[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/actions/workflows/${workflowId}/runs?per_page=${limit}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to get workflow runs: ${response.status} ${response.statusText}`);
      return [];
    }

    const data = await response.json() as { workflow_runs: Array<{
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
    }> };

    return data.workflow_runs.map((run) => ({
      id: run.id,
      name: run.name,
      status: run.status as GitHubWorkflowRun['status'],
      conclusion: run.conclusion as GitHubWorkflowRun['conclusion'],
      html_url: run.html_url,
    }));
  }

  /**
   * Get workflow run by ID
   */
  async getWorkflowRun(runId: number): Promise<GitHubWorkflowRun | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/actions/runs/${runId}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const run = await response.json() as {
      id: number;
      name: string;
      status: string;
      conclusion: string | null;
      html_url: string;
    };

    return {
      id: run.id,
      name: run.name,
      status: run.status as GitHubWorkflowRun['status'],
      conclusion: run.conclusion as GitHubWorkflowRun['conclusion'],
      html_url: run.html_url,
    };
  }

  /**
   * Get releases from GitHub
   */
  async getReleases(limit: number = 30): Promise<GitHubRelease[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/releases?per_page=${limit}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      console.error(`Failed to get releases: ${response.status} ${response.statusText}`);
      return [];
    }

    const releases = await response.json() as Array<{
      id: number;
      tag_name: string;
      name: string;
      body: string;
      html_url: string;
      created_at: string;
      published_at: string | null;
    }>;

    return releases.map((release) => ({
      id: release.id,
      tag_name: release.tag_name,
      name: release.name,
      body: release.body,
      html_url: release.html_url,
      created_at: release.created_at,
      published_at: release.published_at,
    }));
  }

  /**
   * Get release by tag
   */
  async getReleaseByTag(tag: string): Promise<GitHubRelease | null> {
    if (!this.isConfigured()) {
      return null;
    }

    const url = `${this.apiBase}/repos/${this.owner}/${this.repo}/releases/tags/${tag}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      return null;
    }

    const release = await response.json() as {
      id: number;
      tag_name: string;
      name: string;
      body: string;
      html_url: string;
      created_at: string;
      published_at: string | null;
    };

    return {
      id: release.id,
      tag_name: release.tag_name,
      name: release.name,
      body: release.body,
      html_url: release.html_url,
      created_at: release.created_at,
      published_at: release.published_at,
    };
  }
}

