export interface Education {
  program: string;
  institution: string;
  period: string;
  expected?: boolean;
}

export const education: Education[] = [
  {
    program: 'B.Sc. Computer Science',
    institution: 'Universitas Cakrawala',
    period: 'Mar 2026 – 2030',
    expected: true,
  },
  { program: 'Multimedia', institution: 'SMK Negeri 1 Raya', period: '2020' },
];

export interface Credential {
  name: string;
  issuer: string;
}

export const credentials: Credential[] = [{ name: 'Microsoft Certified: Azure AI Fundamentals', issuer: 'Microsoft' }];
