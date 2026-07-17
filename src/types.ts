export interface Suggestion {
  category: string;
  detail: string;
}

export interface Analysis {
  id: number;
  filename: string;
  candidateName: string;
  jobTitle: string;
  atsScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  suggestions: Suggestion[];
  extractedText: string;
  jobDescription: string;
  createdAt: string;
}

export interface HistoryItem {
  id: number;
  filename: string;
  candidateName: string;
  jobTitle: string;
  atsScore: number;
  createdAt: string;
}
