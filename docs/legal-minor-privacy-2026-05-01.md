# Afterroar Legal Landscape Memo: Minor Privacy and Age-Gating

**Source:** Manus research, delivered 2026-04-30. Best-effort summary, not legal advice. Lawyer review pending.

This memorandum outlines the federal and state-level legal requirements governing minors' use of the Afterroar platform (HQ + Passport). It specifically addresses the Children's Online Privacy Protection Act (COPPA), recent state-level social media laws in the Midwest (Indiana, Illinois, Michigan, Wisconsin), and practical compliance recommendations for Afterroar's age-gating and event visibility architecture.

## 1. Federal Law: COPPA and the 13-17 Gap

The primary federal law governing children's privacy online is the Children's Online Privacy Protection Act (COPPA). COPPA imposes strict requirements on operators of websites or online services that collect personal information from children under the age of 13 [1].

### The "General Audience" Classification

Crucially, COPPA only applies if a platform is either "directed to children" or has "actual knowledge" that it is collecting personal information from a child under 13 [1]. The Federal Trade Commission (FTC) determines whether a site is directed to children based on several factors, including subject matter, visual content, use of animated characters, and the presence of child-oriented advertising [2].

Tabletop gaming, board games, and event planning are not inherently child-directed subject matters. Assuming Afterroar does not use child-oriented visual content or market specifically to children, it qualifies as a "general audience" platform. A general audience platform is not required to investigate the age of its users. However, if the platform chooses to ask for age (e.g., during registration) and a user indicates they are under 13, the platform gains "actual knowledge" and COPPA is triggered [1].

### The Neutral Age Screen Requirement

If Afterroar chooses to age-gate its platform, it must implement a "neutral age screen." A neutral age screen asks for the user's date of birth (typically month and year) without defaulting to an age over 13 and without suggesting that a certain age is required to access the service [1]. If a user enters a date of birth indicating they are under 13, the platform must use technical measures (such as placing a session cookie) to prevent the user from simply hitting the "back" button and entering a different, older age [1].

### The 13-17 Regulatory Gap

Currently, there is no federal law that mandates specific privacy protections or age-gating for teenagers between the ages of 13 and 17. While legislation such as the Kids Online Safety Act (KOSA) and COPPA 2.0 have been introduced to extend protections to this age group, neither has been enacted into law as of April 2026 [3]. Therefore, at the federal level, Afterroar has significant latitude in how it handles accounts for users aged 13 to 17, provided it complies with general privacy and consumer protection principles.

## 2. State-Level Minor Privacy Laws in the Midwest

In the absence of comprehensive federal legislation for teenagers, several states have enacted or proposed their own minor privacy laws. The landscape in Afterroar's initial rollout region (the Midwest) is highly variable.

### Indiana: HEA 1408

In March 2026, Indiana Governor Mike Braun signed HEA 1408, a law restricting minors' access to social media [4]. The law requires "social media providers" to verify users' ages and obtain parental consent before anyone under 15 can create an account [5].

However, the law defines a "social media provider" very narrowly. To be covered, a platform must meet all of the following criteria:

1. Primarily allow users to upload or view content from other users.
2. Have a substantial youth user base (at least 10% of daily active users are under 16 and spend an average of two hours or more per day on the platform).
3. Use algorithms to analyze user data and select or recommend content.
4. Contain at least one "addictive" feature, such as infinite scroll, public reaction metrics, autoplay video, or live streaming.
5. Be operated by a company generating at least $1 billion in global revenue over any of the past three years [5].

Afterroar does not meet this definition. It is an identity and event management tool, not an algorithm-driven content feed, and it does not meet the $1 billion revenue threshold. Therefore, Indiana's HEA 1408 does not apply to Afterroar.

### Illinois: Biometric Information Privacy Act (BIPA)

Illinois does not currently have a specific minor social media law in effect, though legislation (HB5511) is advancing that would require device-level age verification for social media platforms [6].

The primary legal risk in Illinois is the Biometric Information Privacy Act (BIPA). BIPA applies to the collection of biometric identifiers (such as facial geometry, voiceprints, and fingerprints) from any person, regardless of age [7]. If Afterroar implements any features that process biometric data, such as scanning profile photos for facial recognition or using voice verification, it must strictly comply with BIPA's requirements for written policy, informed written consent, and data destruction [7]. Violations of BIPA carry steep statutory damages and a private right of action.

### Michigan and Wisconsin

Both Michigan and Wisconsin have introduced bills targeting minor online safety and social media age verification in their 2025-2026 legislative sessions [8] [9].

Wisconsin's AB963/SB936, which passed the Assembly in early 2026, imposes age verification and parental consent requirements on "large social media platforms" [9]. Similar to Indiana, this bill targets platforms with at least $1 billion in annual revenue, effectively exempting Afterroar [10]. Michigan's proposed legislation (SB 757-760) is still advancing and should be monitored, but as of April 2026, no minor-specific platform law has been enacted in Michigan [8].

## 3. Compliance Recommendations for Afterroar

Based on the federal and state legal landscape, Afterroar should implement the following architecture to balance compliance, user growth, and the practical realities of venue-hosted events.

### Recommendation 1: Implement a Neutral Age Screen at Registration

Afterroar should ask for the user's date of birth (month and year) during the initial account creation process. This screen must be neutral. It cannot default to an age over 13, and it cannot state "You must be 13 or older to use Afterroar." If a user enters an age under 13, the platform must drop a cookie to prevent them from changing their answer on a second attempt.

### Recommendation 2: Block Under-13 Account Creation

Given the heavy compliance burden of obtaining verifiable parental consent under the 2025 COPPA Rule amendments (which require methods such as credit card transactions, government ID checks, or video conferences) [11], the most practical approach for Afterroar is to simply block users under 13 from creating an account. When an under-13 age is entered, the platform should display a polite message stating that the user is not eligible to create a Passport account at this time.

### Recommendation 3: Apply Privacy-by-Default for 13-17 Users

While federal law does not mandate it, the clear regulatory trend at the state level is toward protecting teenagers [3]. Afterroar should treat users aged 13 to 17 as a distinct cohort. By default, their profiles should be set to the highest privacy level, restricting visibility to their approved "Circle" rather than the broader network. Furthermore, adult-to-minor direct messaging should be disabled or heavily restricted by default to protect against grooming and harassment.

### Recommendation 4: Differentiate Between Platform Events and Venue Events

The issue of minors attending events posted on Afterroar requires a clear distinction between platform liability and venue liability.

When an adult user (18+, ID-verified) creates a private event, Afterroar's current architecture correctly blocks users under 18 from seeing or joining it. This is a sound policy that protects the platform and adult users.

However, when a commercial Venue (a game store, library, or cafe) posts a public event, the liability dynamic shifts. Afterroar is acting as a neutral hosting platform, similar to Eventbrite. The Venue is responsible for determining the age-appropriateness of the event and complying with local laws regarding minors on their physical premises.

Afterroar should allow Venues to explicitly tag their public events as "All Ages" or "18+." If a Venue tags an event as "All Ages," Afterroar can safely display that event to its 13-17 user cohort. The platform should include standard Terms of Service language stating that Venues are solely responsible for the content and age restrictions of their physical events, indemnifying Afterroar from liability arising from a minor's attendance.

### Recommendation 5: Strictly Avoid Biometric Data Collection

To avoid catastrophic liability under Illinois BIPA, Afterroar must ensure that its ID-verification process for adult users does not involve the collection or retention of biometric data [7]. If a third-party vendor is used for ID verification, the vendor contract must explicitly state that no biometric data is retained and that the vendor assumes all BIPA compliance obligations. Furthermore, Afterroar should not implement any features that scan user profile photos for facial recognition purposes.

## References

[1] Federal Trade Commission. "Complying with COPPA: Frequently Asked Questions." https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions

[2] Federal Register. "Children's Online Privacy Protection Rule." https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule

[3] GovTech. "Federal Privacy Bills Have Major Implications for K-12." https://www.govtech.com/education/k-12/federal-privacy-bills-have-major-implications-for-k-12

[4] WANE. "Gov. Braun signs bill into law creating social media restrictions for kids 15 and under." https://www.wane.com/top-stories/gov-braun-signs-bill-into-law-creating-social-media-restrictions-for-kids-15-and-under/

[5] Indiana Insight. "The social media experiment." https://www.indianainsight.com/2026/03/13/the-social-media-experiment/

[6] Capitol News Illinois. "Lawmakers advance Pritzker's cell phone ban, social media regulations." https://capitolnewsillinois.com/news/lawmakers-advance-pritzkers-cell-phone-ban-social-media-regulations/

[7] Illinois General Assembly. "Biometric Information Privacy Act (BIPA)." http://www.ilga.gov/legislation/ilcs/ilcs3.asp?ActID=3004&ChapterID=57

[8] Michigan Legislature. "SOCIAL MEDIA REGULATIONS; YOUTH S.B. 757 - 760." https://www.legislature.mi.gov/documents/2025-2026/billanalysis/Senate/pdf/2025-SFA-0757-G.pdf

[9] ACLU of Wisconsin. "AB-963/SB-936: Social Media Age Verification." https://www.aclu-wi.org/legislation/ab-963-sb-936-social-media-age-verification/

[10] BillTrack50. "WI AB963 - Bill." https://www.billtrack50.com/billdetail/1957752

[11] Gibson Dunn. "FTC Updates to the COPPA Rule Impose New Compliance Obligations." https://www.gibsondunn.com/ftc-updates-to-coppa-rule-impose-new-compliance-obligations-for-online-services-that-collect-data-from-children/

## Afterroar's Implementation Choice (post-Manus)

Shawn explicitly chose to require parental consent for 13-17 even though Manus research says federal law doesn't require it. Rationale:

- Adds a $5/mo paying-Pro-parent requirement as deterrent until lawyer reviews
- Built behind feature flag `PARENTAL_CONSENT_REQUIRED` (default true) so removal post-legal-review is one env var flip
- 13-17 cohort with parental consent: privacy-by-default (Circle visibility, no adult-to-minor DMs), can see only "All Ages" + "13+" venue events, cannot see user-hosted public events, cannot become Pro

When lawyer review clears the parental-consent gate, set `PARENTAL_CONSENT_REQUIRED=false` and the 13-17 cohort signs up directly with the same privacy defaults (no parent linkage required).
