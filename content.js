/* AI lunch · content. Everything people read in the session lives in this file. */
window.CONTENT = (function () {
  'use strict';

  /* ---------- the cards ----------
     Quick check: one right answer (ans = index), with an explanation and a tip for the file.
     Us / The client: dilemmas without a single right answer, with what tends to matter. */
  var CARDS = [
    { id: 'q1', pack: 'q', tag: 'Same prompt, new answer',
      title: 'Monday and Tuesday you paste the same instructions into the tool. You get different exceptions back. Why?',
      opts: ['Someone must have changed the data.', 'It generates text by probability, so two runs can differ.', 'It learned from Monday’s chat.'],
      ans: 1,
      expl: 'The model is not looking an answer up; it produces a likely next word. Two runs can differ even with the same prompt, and the tool can be updated under you. Most business tools do not learn from your chat on the fly.',
      tip: 'For the file: keep the output you actually used, not only the prompt.' },
    { id: 'q2', pack: 'q', tag: 'Nothing unusual found',
      title: 'Overnight, the tool reads all 214 customer contracts and reports: “No unusual terms found.” What do you know now?',
      opts: ['There are no unusual terms.', 'What it found — not what is in there.', 'Enough for a low-risk area: document it and move on.'],
      ans: 1,
      expl: 'A clean result says as much about what the tool was looking for as about the contracts. Coverage is not assurance.',
      tip: 'Ask what a miss would look like. Plant one contract with a known odd term and see if the run catches it.' },
    { id: 'q4', pack: 'q', tag: '23:40, one formula',
      title: '23:40. You paste the client’s revenue schedule — name removed — into a free chatbot to fix one formula. What just happened?',
      opts: ['Nothing serious: no name, no client.', 'You shared client data with a third party.', 'Fine, as long as you delete the chat afterwards.'],
      ans: 1,
      expl: 'Removing the name rarely anonymises anything: revenue by month often identifies the client on its own. Deleting the chat does not undo the sharing, and free tools may keep and use what you paste.',
      tip: 'Confidentiality is a professional duty, not a setting in the tool.' },
    { id: 'q6', pack: 'q', tag: 'Fake, in minutes',
      title: 'Which of these can be convincingly faked with freely available AI today?',
      opts: ['A bank statement PDF.', 'The CFO’s voice on a phone call.', 'Both — in minutes.'],
      ans: 2,
      expl: 'Documents and voices are now cheap to fake. In 2024 an employee in Hong Kong transferred about 25 million US dollars after a video call in which the “CFO” and colleagues were all deepfakes.',
      tip: 'Authenticity is back on the list: get evidence through channels you control, and call back on a number you already have.' },

    { id: 'u1', pack: 'u', tag: 'Tooling',
      title: '23:40, busy season. The partner wants the analysis at 8:00. The fastest route is a chatbot that isn’t on the approved list.',
      opts: ['Use it — names stripped, nobody will know.', 'Do it the slow way tonight, flag the problem tomorrow.', 'Message the partner: “OK to use it just this once?”'],
      take: 'Stripping names is not a safeguard, and a deadline is not a mandate. The real question is why the approved route is slower, and how long an approval takes.',
      tip: 'If people regularly reach for A, the list is the problem, not the people.' },
    { id: 'u3', pack: 'u', tag: 'Review',
      title: 'Your review notes are back: 14 polished, generic points. Three ask for things that are already in the file. It reads as if the reviewer pasted your file into AI.',
      opts: ['Answer all 14 literally and move on.', 'Walk over and ask what they were actually worried about.', 'Reply: “Did you use AI for these?”'],
      take: 'Answering generic notes literally costs more time than asking what the reviewer was worried about. That question is also the polite version of the harder one.',
      tip: 'Review is a conversation, and that is the part a tool cannot take over.' },
    { id: 'u4', pack: 'u', tag: 'Client call',
      title: 'Call with the client’s controller. Your colleague’s AI notetaker joined; nobody mentioned it. Then the controller starts on a reorganisation the staff don’t know about yet.',
      opts: ['Say it now, and ask if it’s OK to record.', 'Mention it when you send the notes.', 'Leave it — it’s our own tooling.'],
      take: 'Recording someone without telling them is a trust problem before it is a privacy one. Saying it at the start costs ten seconds; saying it afterwards costs more.',
      tip: 'Worth one firm-wide line, so nobody has to decide alone in the moment.' },
    { id: 'u5', pack: 'u', tag: 'Hours',
      title: 'AI saved you five hours on a section budgeted at eight. Timesheets are due.',
      opts: ['Book the three I spent.', 'Book three, spend the other five elsewhere on the job.', 'Book eight — the fee was agreed.'],
      take: 'Booking hours you did not work hides where AI actually helps, and we need that signal for pricing and planning.',
      tip: 'The honest version only works if saved time is not instantly taken away from the team.' },
    { id: 'u6', pack: 'u', tag: 'Team',
      title: '18:00. A first-year hands you a flawless-looking analysis. You ask about one step. “Honestly? ChatGPT did that part.”',
      opts: ['Send it back to redo by hand.', 'Walk through that step together, now.', 'Check it myself — the deadline is tomorrow.'],
      take: 'Checking it yourself fixes the deadline and nothing else. Walking through the step takes fifteen minutes and is the only version where the work gets done twice as well next time.',
      tip: 'Also notice who could not ask for help earlier, and why.' },

    { id: 'c2', pack: 'c', tag: 'Control',
      title: 'The control reads: “AI flags anomalies, the controller reviews the exceptions.” Last quarter: zero flags.',
      opts: ['Test the controller’s follow-up on flags.', 'Ask what the model doesn’t flag — and why it stayed silent.', 'Treat it as a manual control, nothing new.'],
      take: 'Testing the follow-up only covers what was flagged. The real weakness is everything the model stayed silent about.',
      tip: 'Useful question: what did it flag before, and what did the reviewer do with it?' },
    { id: 'c3', pack: 'c', tag: 'Evidence',
      title: 'To support cut-off, the CFO sends a ChatGPT summary: “All December deliveries were completed before year-end.” It reads well.',
      opts: ['Accept it — the reasoning is sound.', 'Ask for the underlying delivery documents.', 'File it as management’s view, test it ourselves.'],
      take: 'A summary is management’s assertion with better grammar. It can tell you what they think; it cannot be the support.',
      tip: 'Ask for the documents it was built from, then do your own work on them.' },
    { id: 'c4', pack: 'c', tag: 'Estimate',
      title: 'The churn assumption in the revenue accrual comes from a vendor model nobody at the client can explain. The CFO: “It’s been right for two years.”',
      opts: ['Test the outcome against last year.', 'Keep asking until someone owns the model.', 'Build our own independent estimate.'],
      take: 'An estimate the client cannot explain is an estimate the client does not own. That is a finding in itself, whatever the number turns out to be.',
      tip: 'An independent expectation of your own is usually faster than reverse-engineering their model.' },
    { id: 'c6', pack: 'c', tag: 'Our own tool',
      title: 'Our tool scans all 48,000 journal entries and returns twelve exceptions. It’s the day before the deadline.',
      opts: ['Follow up the twelve and conclude.', 'First check the data going in is complete.', 'Also ask what it would have missed.'],
      take: 'Scanning everything feels like completeness, but it only covers the data that was loaded and the patterns that were asked for.',
      tip: 'Reconcile the input to the ledger first; then ask what kind of entry would slip past these rules.' }
  ];
  var PACKS = {
    q: { name: 'Quick check', line: 'What does this thing actually do?', count: 'Everyone lands on a letter before the room starts talking.' },
    u: { name: 'Us', line: 'Using AI in our own work', count: 'No single right answer. Pick the letter closest to what you would really do.' },
    c: { name: 'The client', line: 'AI as evidence, AI in their controls', count: 'Most of these have more than one defensible answer. The useful part is hearing why someone picked a different one.' }
  };

  /* ---------- icebreaker ---------- */
  // x: 0 conservative (left) to 100 innovative (right); y: 0 pessimistic (bottom) to 100 optimistic (top)
  var QUADRANTS = [
    { id: 'be', name: 'Patient optimists', line: 'Hopeful, but waiting until it’s proven', x: 0, y: 1, col: 'var(--purple)', tek: 'q_believer' },
    { id: 'pi', name: 'Pioneers', line: 'Optimistic, and trying it first', x: 1, y: 1, col: 'var(--teal)', tek: 'q_pioneer' },
    { id: 'gu', name: 'Guardians', line: 'Sceptical, and careful first', x: 0, y: 0, col: 'var(--blue)', tek: 'q_guardian' },
    { id: 'te', name: 'Critical testers', line: 'Trying it, with their eyes open', x: 1, y: 0, col: 'var(--orange)', tek: 'q_tester' }
  ];
  var AXES = {
    left: ['Conservative', 'I wait until it is proven'],
    right: ['Innovative', 'I try new tools first'],
    top: ['Optimistic', 'AI brings our work more value than risk'],
    bottom: ['Pessimistic', 'AI brings our work more risk than value']
  };
  var USES = ['Drafting emails and client requests', 'Documenting working papers and memos', 'Answering or tidying review notes',
    'Summarising long documents', 'Reading contracts and minutes', 'Excel and data: formulas, journal entries, scripts',
    'Questions on standards (IFRS, Dutch GAAP, NV COS) or tax', 'Planning and risk assessment', 'Translating', 'Meeting notes', 'Not yet'];
  // the last tool is 'Something else': choosing it asks which one
  var TOOLS = ['SpiceGPT', 'ChatGPT', 'Microsoft Copilot', 'Claude', 'Gemini', 'DeepL', 'Perplexity', 'Something else'];

  /* ---------- brainstorm ---------- */
  var GROUPS = [
    ['Tickmark', '#00A99D'], ['Cut-off', '#E07B2E'], ['Materiality', '#7E5BB5'], ['Walkthrough', '#2F6FAE'],
    ['Sample', '#C8463C'], ['Footnote', '#B38609'], ['Roll-forward', '#4C9238'], ['Sign-off', '#BD467C']
  ];
  var SPARKS = [
    'Which part of your week still takes far too long?',
    'Where did you try one of our AI tools and give up — and why?',
    'What do you still do by hand that a tool could do?',
    'What would have saved you at 23:40 in March?'
  ];
  // the last topic is 'Other': choosing it asks what about
  var TOPICS = ['Hands-on: prompting for audit work', 'Our approved tools and rules', 'AI at our clients: audit approach',
    'Working on one of today’s needs', 'Other'];

  /* ---------- the session ----------
     type: what kind of step; min: minutes planned; opt: can be skipped; card: default card for card steps */
  var STEPS = [
    { id: 'welcome', type: 'welcome', min: 2, label: 'Welcome', title: 'AI & Ethics — the lunch edition', tek: 'welcome',
      prompt: 'Scan the code, keep eating, answer on your phone.',
      rules: ['Everything is anonymous: nobody, the host included, can see who answered what.',
              'Nothing said here follows anyone around.',
              'First everyone answers, then we talk. That way the quieter view survives contact with the loudest one.'] },
    { id: 'words', type: 'words', min: 3, label: 'Icebreaker', title: 'AI in one word', tek: 'words',
      prompt: 'What comes to mind first when you hear “AI”? One to three words. No wrong answers.' },
    { id: 'matrix', type: 'matrix', min: 2, label: 'Icebreaker', title: 'Where do you stand?', tek: 'matrix',
      prompt: 'Tap where you are today. Left to right: how you work with new tools. Bottom to top: what AI will do for our work.' },
    { id: 'patterns', type: 'patterns', min: 3, label: 'Icebreaker', title: 'The room on one map', tek: 'patterns',
      prompt: 'Every dot is one of us, with the words that person chose.',
      ask: ['Which corner is busiest — and is that a surprise?', 'Do the words change from corner to corner?', 'Where would you put J&S as a firm? And our clients?'] },
    { id: 'using', type: 'using', min: 2, label: 'Warm-up', title: 'What are we already using?', tek: 'using',
      prompt: 'Anonymous. Tick what you used AI for at work in the past month, and with which tools.' },
    { id: 'quiz1', type: 'card', pack: 'q', card: 'q4', min: 4, label: 'Quick check', title: 'Quick check', tek: 'quiz' },
    { id: 'quiz2', type: 'card', pack: 'q', card: 'q6', min: 3, opt: 1, label: 'Quick check', title: 'Quick check, round two', tek: 'quiz' },
    { id: 'us', type: 'card', pack: 'u', card: 'u6', min: 4, label: 'Dilemma', title: 'Dilemma: us', tek: 'us' },
    { id: 'client', type: 'card', pack: 'c', card: 'c3', min: 4, opt: 1, label: 'Dilemma', title: 'Dilemma: the client', tek: 'client' },
    { id: 'groups', type: 'groups', min: 1, label: 'Brainstorm', title: 'Find your group', tek: 'groups',
      prompt: 'Look at your phone and find the others with the same colour. Hold it up!' },
    { id: 'ideas', type: 'ideas', min: 7, clock: 420, label: 'Brainstorm', title: 'What would help you do your work better?', tek: 'ideas',
      prompt: 'We already have our own AI tools. In your group: what do you need to do your work better — and why doesn’t what we have today solve it? As many as you like.' },
    { id: 'pitch', type: 'pitch', min: 4, label: 'Brainstorm', title: 'Thirty seconds per group', tek: 'pitch',
      prompt: 'Each group presents the need it finds most important. Everyone else: listen for the one you recognise.' },
    { id: 'rank', type: 'rank', min: 3, label: 'Brainstorm', title: 'Spend your three dots', tek: 'rank',
      prompt: 'Give your dots to the needs we should solve first. One dot per need.' },
    { id: 'close', type: 'close', min: 2, label: 'Wrap-up', title: 'What happens next', tek: 'close',
      prompt: 'Two quick taps, then we’re done.' },
    { id: 'thanks', type: 'thanks', min: 1, label: 'The end', title: 'Thank you!', tek: 'thanks',
      prompt: 'For your honesty and your ideas. We’ll share what came out of today.' }
  ];

  return { CARDS: CARDS, PACKS: PACKS, QUADRANTS: QUADRANTS, AXES: AXES, USES: USES, TOOLS: TOOLS,
           GROUPS: GROUPS, SPARKS: SPARKS, TOPICS: TOPICS, STEPS: STEPS };
})();
