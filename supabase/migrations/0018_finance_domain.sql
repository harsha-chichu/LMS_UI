-- LMS: finance & accounting domain.
-- Run once in the Supabase SQL editor, after 0017 and BEFORE deploying the code that offers the domain.
-- Safe to re-run: the constraint and function are replaced, existing questions are skipped.
--
-- Adds 'finance-accounting' to the question bank's allowed domains and the admin coverage view, and seeds
-- 111 questions: 33 from a CA's fresher interview guide (finance, audit and grc) plus
-- 78 more covering tax, gst and harder cases. Mostly indian rules (ind as, income-tax act, gst,
-- companies act 2013, sas) with ifrs and general finance mixed in.

alter table public.lms_questions drop constraint if exists lms_questions_domain_check;
alter table public.lms_questions add constraint lms_questions_domain_check
  check (domain in ('ai-ml', 'data-science', 'backend', 'frontend', 'system-design', 'behavioral', 'finance-accounting'));

-- Same as 0014, with the new domain in the list.
create or replace function public.lms_admin_bank_coverage()
returns table (domain text, difficulty text, active bigint, retired bigint, generated bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    d.domain, f.difficulty,
    count(q.id) filter (where q.status = 'active'),
    count(q.id) filter (where q.status = 'retired'),
    count(q.id) filter (where q.source = 'generated')
  from unnest(array['ai-ml', 'data-science', 'backend', 'frontend', 'system-design', 'behavioral', 'finance-accounting']) as d(domain)
  cross join unnest(array['easy', 'medium', 'hard']) as f(difficulty)
  left join public.lms_questions q on q.domain = d.domain and q.difficulty = f.difficulty
  group by 1, 2
  order by 1, 2;
$$;

insert into public.lms_questions (domain, difficulty, text, topics, source) values
  ('finance-accounting', 'easy', 'what are the three main financial statements, and how do they link together?', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'medium', 'how does a depreciation charge of 100 flow through the three financial statements if the tax rate is 25%?', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the difference between accrual accounting and cash accounting?', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what are the five steps of revenue recognition under ifrs 15 / ind as 115?', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the difference between a provision and a contingent liability?', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'medium', 'how does ifrs 16 / ind as 116 treat leases for a lessee?', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is deferred tax?', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is working capital, and what does it tell you?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'easy', 'which ratios would you check first when looking at a company''s financial statements?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'medium', 'can a profitable company run out of cash? how?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is ebitda, and what is its main limitation?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what are npv and irr?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what is wacc, and how is it calculated?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what is the difference between enterprise value and equity value?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the objective of an external audit?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is materiality in an audit?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'medium', 'explain the audit risk model.', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what are the financial statement assertions?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what is the difference between tests of controls and substantive procedures?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'medium', 'how would you verify trade receivables?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what is the difference between vouching and tracing?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what are the types of audit opinion?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'easy', 'why is auditor independence important?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is grc (governance, risk and compliance)?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is internal control? name the five coso components.', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the difference between preventive, detective and corrective controls? give an example of each.', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the difference between inherent risk and residual risk?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what are the four risk responses?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is segregation of duties, and why does it matter?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'medium', 'explain the three lines model.', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is sox, and what does section 404 require?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what is a walkthrough, and why do auditors perform one?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what is the difference between design effectiveness and operating effectiveness of a control?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the difference between capital expenditure and revenue expenditure? give an example of each.', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the going concern assumption, and why does it matter?', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'medium', 'how would you account for inventory that has fallen below cost? walk me through the entry.', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what is the difference between an adjusting and a non-adjusting event after the reporting period? give an example of each.', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'medium', 'explain how a bank reconciliation works and the usual reasons the bank and book balances differ.', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'hard', 'a software company sells a licence, a year of support and installation in one contract for one price. how would you recognise the revenue under ind as 115?', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'hard', 'a subsidiary is acquired for more than the fair value of its net assets. how is goodwill measured and tested for impairment under ind as 103 and ind as 36?', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'hard', 'a company has deferred tax assets from years of losses. how would you decide whether to keep recognising them?', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'hard', 'what are the key differences between ind as and ifrs that an indian company reporting to a foreign parent should watch for?', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'hard', 'a company changes its depreciation method from straight line to written down value. how do you account for it, and what do you disclose?', array['accounting & standards']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the difference between gross margin, operating margin and net margin?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what does the current ratio measure, and why can a very high one be a bad sign?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the difference between fixed costs and variable costs? give an example of each.', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'medium', 'how would you calculate and interpret the cash conversion cycle?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'medium', 'a company''s revenue grew 20% but its operating cash flow fell. what would you look at to explain it?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what is contribution margin, and how would you use it to find a break-even point?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'medium', 'how would you explain a profit and loss statement to a manager with no finance background?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'hard', 'two companies in the same industry have the same roe. how would you use a dupont analysis to tell which is the stronger business?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'hard', 'what signs in the financial statements would make you suspect aggressive revenue recognition or earnings management?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'hard', 'how would you build a monthly cash flow forecast for a business that is close to breaching its loan covenants?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'hard', 'standard costing shows a large adverse material variance. how would you break it down and find the cause?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'hard', 'how would you set up a three-statement financial model in excel so the balance sheet always balances?', array['financial analysis']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the time value of money?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the difference between debt and equity financing?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is free cash flow?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the payback period, and what is its main weakness?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'medium', 'walk me through a discounted cash flow valuation.', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'medium', 'how would you use comparable company multiples to value a business, and what can go wrong?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'medium', 'how does the capm estimate the cost of equity?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'hard', 'your dcf value is very sensitive to the terminal value. how would you test and defend your assumptions?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'hard', 'npv and irr rank two mutually exclusive projects differently. which would you choose, and why?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'hard', 'how would you value an early-stage company with negative cash flows?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'hard', 'a company wants to raise funds. how would you decide between issuing equity, taking a bank loan or issuing bonds?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'hard', 'what should a buyer look for in financial due diligence before an acquisition?', array['corporate finance & valuation']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is audit evidence, and what makes it reliable?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what would you do during your articleship if you found a significant error in a client''s ledger?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'hard', 'during the audit you find signs the client may not be a going concern. what procedures would you perform, and how could it affect your report?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'hard', 'how would you plan the audit of inventory at a company with stock held at many locations?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'hard', 'management refuses to adjust a misstatement you believe is material. what are your options?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'hard', 'what are key audit matters under sa 701, and how do you decide what to include?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'hard', 'how would you respond to a risk of fraud in revenue recognition?', array['audit & assurance']::text[], 'seed'),
  ('finance-accounting', 'medium', 'how would you build a risk register for a mid-sized company?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what is a risk and control matrix, and what does it contain?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'hard', 'a control failed testing in the middle of the year. how would you assess the impact and what would you recommend?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'hard', 'how does internal financial control reporting under the companies act 2013 compare with sox 404?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'hard', 'how would you design controls to stop duplicate or fake vendor payments?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'hard', 'what are the main controls over user access in an erp system, and how would you test them?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'hard', 'the board asks how well risk is managed in the company. how would you set up key risk indicators and report on them?', array['governance, risk & compliance']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the difference between the previous year and the assessment year under the income-tax act?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is tds, and who is responsible for deducting it?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what are the five heads of income under the income-tax act?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the difference between the old and new tax regimes for individuals?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is advance tax, and who has to pay it?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'medium', 'how is the residential status of an individual determined, and why does it matter?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'medium', 'how are short-term and long-term capital gains on listed shares taxed?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what happens if tds is deducted but not deposited on time?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what is the difference between book profit and taxable profit for a company? name common reconciling items.', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'medium', 'when does a business need a tax audit under section 44ab?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'hard', 'a client receives a notice for income escaping assessment. how would you approach the reply?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'hard', 'how do transfer pricing rules apply to a transaction between an indian company and its foreign parent?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'hard', 'how would you advise a client on carrying forward and setting off business losses and capital losses?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'hard', 'what is minimum alternate tax, and when does it still apply to a company?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'hard', 'how would a double taxation avoidance agreement affect the tax on fees paid to a foreign consultant?', array['direct tax']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is gst, and what are cgst, sgst and igst?', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is input tax credit?', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is the difference between gstr-1 and gstr-3b?', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'easy', 'what is reverse charge under gst? give an example.', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'easy', 'who has to register under gst?', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'medium', 'how do you decide the place of supply, and why does it matter for igst versus cgst and sgst?', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'medium', 'a client''s input tax credit was denied because the supplier didn''t file gstr-1. what can the client do?', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what is the composition scheme, and when is it a good choice?', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'medium', 'how is gst treated on exports, and what are the refund options?', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'medium', 'what is an e-way bill, and when is it needed?', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'hard', 'how would you reconcile a company''s purchase register with gstr-2b, and what would you do about the differences?', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'hard', 'a company supplies goods and installation together. how do you decide whether it is a composite or a mixed supply, and why does it matter?', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'hard', 'what are the risks when a company transfers stock between branches in different states under gst?', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'hard', 'how would you prepare a client for a gst audit or departmental inquiry?', array['gst & indirect tax']::text[], 'seed'),
  ('finance-accounting', 'hard', 'how are inverted duty structures handled under gst, and how is the refund calculated?', array['gst & indirect tax']::text[], 'seed')
on conflict (domain, text_key) do nothing;
