// Real, verified enforcement cases that each Tidewell broken promise mirrors.
export interface RealCase {
  company: string;
  amount: string;
  year: string;
  what: string;
  source: string;
}

export const CASES: RealCase[] = [
  {
    company: 'Twitter',
    amount: '$150M',
    year: '2022',
    what: 'Phone numbers collected for account security were used to target ads.',
    source: 'https://www.ftc.gov/news-events/news/press-releases/2022/05/ftc-charges-twitter-deceptively-using-account-security-data-sell-targeted-ads',
  },
  {
    company: 'Meta',
    amount: '€91M',
    year: '2024',
    what: 'Hundreds of millions of passwords stored in readable form.',
    source: 'https://www.dataprotection.ie/en/news-media/press-releases/DPC-announces-91-million-fine-of-Meta',
  },
  {
    company: 'BetterHelp',
    amount: '$7.8M',
    year: '2023',
    what: 'Health questionnaire data shared with Facebook, Snapchat, Criteo and Pinterest.',
    source: 'https://www.ftc.gov/news-events/news/press-releases/2023/03/ftc-ban-betterhelp-revealing-consumers-data-including-sensitive-mental-health-information-facebook',
  },
  {
    company: 'GoodRx',
    amount: '$1.5M',
    year: '2023',
    what: 'Promised never to share health data with advertisers. Its code did.',
    source: 'https://www.ftc.gov/news-events/news/press-releases/2023/02/ftc-enforcement-action-bar-goodrx-sharing-consumers-sensitive-health-info-advertising',
  },
];

// Which real case each Tidewell promise section mirrors, shown on the demo page.
export const CASE_BY_SECTION: Record<string, string> = {
  '3.2': 'Mirrors Twitter: $150M (FTC, 2022)',
  '4.1': 'Mirrors GoodRx: $1.5M (FTC, 2023)',
  '4.3': 'Mirrors BetterHelp: $7.8M (FTC, 2023)',
  '5.1': 'Mirrors Meta: €91M (Irish DPC, 2024)',
  '6.1': 'GDPR Article 17: the right to erasure',
};
