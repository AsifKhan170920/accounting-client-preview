/* ===================== demo data + accounting engine ===================== */
function seedDemoRecords(){
  let id=2000;
  const bank=[['ADCB',165568.42],['ADIB',0],['Bank of Baroda',0],['Cash Account',-155646.51],
    ['Cheque Return',-325.00],['EMIRATES NBD - MRS. BATUL',54500.00],['HBZ',15571.05],
    ['IBRAHIM BANK LTD',0],['Pdc Issued',0],['Pdc Recieved',0],['PETTY CASH A/C',0]]
    .map(([name,balance])=>({id:id++,name,currency:'AED',balance}));
  const rc=[['2025-05-31','43856','ADCB - ADCB','RIAZ MIRZA',660.00],
    ['2025-05-31','43855','ADCB - ADCB','MIRDIF ALUMINIUM & GLASS',4623.00],
    ['2025-05-31','43854','Cash Account - Cash Account','FAISAL BOOTA GLASS & ALUMINIUM',1000.00],
    ['2025-05-31','43853','Cash Account - Cash Account','ONEIRA TECH',1650.00],
    ['2025-05-31','43852','Cash Account - Cash Account','SAPNA TECH TECHNICAL SERVICES LLC',100.00],
    ['2025-05-31','43851','Cash Account - Cash Account','ADHAM GLASS',542.00],
    ['2025-05-31','43850','Cash Account - Cash Account','OSOUD AL SAHIRH',675.00],
    ['2025-05-31','43849','ADCB - ADCB','Al Batra Glass',624.00],
    ['2025-05-31','43848','ADCB - ADCB','MANCHESTER ALUMINIUM & GLASS WORKSHOP LLC',5091.00],
    ['2025-05-30','43790','ADCB - ADCB','TECH N TALENT',954.50],
    ['2025-05-30','43789','Cash Account - Cash Account','ABDULLA GLASS',1414.00],
    ['2025-05-30','43788','Cash Account - Cash Account','HUSSAIN BHAI',1000.00]]
    .map(([date,reference,receivedIn,description,amount])=>({id:id++,date,reference,receivedIn,description,paidBy:'',amount}));
  const customers=[
    {id:id++,name:'MIRDIF ALUMINIUM & GLASS',code:'C-001',address:'Industrial Area 12, Warehouse 7\nDubai, UAE',phone:'+971 4 555 0101',email:'accounts@mirdifglass.ae',trn:'100311223300003',balance:0},
    {id:id++,name:'MANCHESTER ALUMINIUM & GLASS WORKSHOP LLC',code:'C-002',address:'Al Quoz, Street 7\nDubai, UAE',phone:'+971 4 555 0102',email:'info@manchesterglass.ae',trn:'100455667700003',balance:0},
    {id:id++,name:'RIAZ MIRZA',code:'C-003',address:'Sharjah Industrial 5\nSharjah, UAE',phone:'+971 6 555 0103',email:'riaz@example.ae',trn:'',balance:0}];
  const suppliers=[
    {id:id++,name:'Gulf Glass Suppliers LLC',code:'S-001',address:'Jebel Ali Free Zone, Plot 220\nDubai, UAE',phone:'+971 4 555 0201',email:'sales@gulfglass.ae',trn:'100788990000003',balance:0}];
  return {bankCash:bank, receipts:rc, customers, suppliers};
}
function demoBusiness(){
  return {id:1001,name:'Abbass Tempering Industry LLC',country:'United Arab Emirates',created:'2026-01-01T00:00:00.000Z',
    period:{mode:'ytd',from:'2026-01-01',to:'2026-05-29',excludeZero:false,description:'Summary'},
    records:seedDemoRecords(),
    balanceSheet:[
      {title:'Assets',total:5172571.45,children:[
        {name:'Current Assets',total:2656185.05,children:[{name:'Accounts receivable',amt:2627821.09},
          {name:'Cash & cash equivalents',amt:79667.96},{name:'Deposits (Asset)',amt:1000.00},{name:'Loans & Advances (Asset)',amt:-52304.00}]},
        {name:'Non Current Assets',total:2516386.40,children:[{name:'Fixed assets, accumulated depreciation',amt:-282085.98},
          {name:'Fixed assets, at cost',amt:2798472.38}]}]},
      {title:'Liabilities',total:2254563.60,children:[{name:'Accounts payable',amt:2498023.76},
        {name:'Employee clearing account',amt:-331361.39},
        {name:'Tax Payable',total:88991.87,children:[{name:'Input VAT',amt:-92834.61},{name:'Output VAT',amt:181826.48}]},
        {name:'Unsecured Loans',amt:-1090.64}]},
      {title:'Equity',total:2918007.85,children:[{name:'Capital Accounts',amt:-129949.95},{name:'CURRENT ACCOUNT',amt:-44950.00},
        {name:'Retained earnings',amt:3041052.21},{name:'Suspense',amt:51855.59}]}],
    profitLoss:[], coaSeedV:3,
  };
}
function emptySummary(){
  return {balanceSheet:[{title:'Assets',total:0,children:[]},{title:'Liabilities',total:0,children:[]},{title:'Equity',total:0,children:[]}],
    profitLoss:[]};
}
function currencyForCountry(c){ const m={'United Arab Emirates':'AED','United States':'USD','United Kingdom':'GBP','India':'INR','Pakistan':'PKR','Saudi Arabia':'SAR','Australia':'AUD','Canada':'CAD','Singapore':'SGD','New Zealand':'NZD'}; return m[c]||'AED'; }
function defaultTaxCodes(){ return [{name:'VAT 5%',rate:5},{name:'Zero-rated',rate:0},{name:'Exempt',rate:0}]; }
function ensureSettings(b){
  if(!b.details) b.details={};
  if(!b.baseCurrency) b.baseCurrency=currencyForCountry(b.country);
  if(!b.fmt) b.fmt={date:'MM/DD/YYYY',sep:'comma-dot',decimals:2};
  if(!b.taxCodes) b.taxCodes=defaultTaxCodes();
  if(b.lockDate==null) b.lockDate='';
  if(b.id===1001 && !b.details.address){ b.details={legalName:'Abbass Tempering Industry LLC',
    address:'Industrial Area\nSharjah\nUnited Arab Emirates',email:'',phone:'',taxNumber:'100000000000003',logo:''}; }
}
const COA_SECTIONS_DEFAULT={assets:'Assets',liabilities:'Liabilities',equity:'Equity',income:'Income',expenses:'Less Cost Of Sales'};
const CONTROL_NAMES={'Accounts receivable':1,'Accounts payable':1,'Cash & cash equivalents':1,'Capital Accounts':1,'Inventory on hand':1,'Employee clearing account':1};
function ensureCoa(b){
  if(!b.coaSections) b.coaSections={assets:'Assets',liabilities:'Liabilities',equity:'Equity'};
  if(b.balanceSheet) b.balanceSheet.forEach((s,i)=>{ const k=['assets','liabilities','equity'][i]; if(k&&s.title) b.coaSections[k]=s.title; });
  if(b.coa && b.coaV===2) return;                 // already on current schema
  const coa=[]; let c=0; const nid=p=>(p||'a')+(++c)+Math.random().toString(36).slice(2,5);
  const addBS=(children,parentKey)=>{ (children||[]).forEach(ch=>{ if(ch.children){ const gid=nid('g'); coa.push({id:gid,type:'group',name:ch.name,code:'',parent:parentKey}); addBS(ch.children,gid); }
    else coa.push({id:nid('a'),type:'account',name:ch.name,code:'',parent:parentKey,balance:(+ch.amt||0),control:!!CONTROL_NAMES[ch.name]}); }); };
  (b.balanceSheet||[]).forEach((s,i)=>{ const k=['assets','liabilities','equity'][i]; if(k) addBS(s.children,k); });
  let re=coa.find(n=>n.type==='account'&&/retained earnings/i.test(n.name));
  if(re){ re.mandatory=1; re.control=1; } else coa.push({id:nid('a'),type:'account',name:'Retained earnings',code:'',parent:'equity',balance:0,mandatory:1,control:1});
  // Profit & Loss: only build groups for sections that actually contain accounts (no empty default Income/Cost groups)
  const plTop=[];
  const addPL=(children,parentId)=>{ (children||[]).forEach(ch=>{ if(ch.children){ const gid=nid('g'); coa.push({id:gid,type:'group',name:ch.name,code:'',parent:parentId}); addPL(ch.children,gid); }
    else coa.push({id:nid('a'),type:'account',name:ch.name,code:'',parent:parentId,balance:(+ch.amt||0)}); }); };
  (b.profitLoss||[]).forEach((s,i)=>{ if(!(s.children&&s.children.length)) return; const kind=(i===0)?'income':'expense';
    const gid=nid('g'); coa.push({id:gid,type:'group',name:s.title||(kind==='income'?'Income':'Expenses'),code:'',parent:'pl',plkind:kind}); plTop.push(gid); addPL(s.children,gid); });
  const tid='t'+Math.random().toString(36).slice(2,9); coa.push({id:tid,type:'total',side:'pl',name:'Net profit (loss)'}); plTop.push(tid);
  b.coa=coa; b.coaTop={bs:['assets','liabilities','equity'],pl:plTop}; b.coaV=2;
}
/* ---------- posting / ledger engine ---------- */
function acctById(b,id){ return (b.coa||[]).find(n=>n.id===id); }
function findAcct(b,name){ return (b.coa||[]).find(n=>n.type==='account'&&n.name===name); }
function acctRoot(b,node){ let n=node,g=0; while(n&&g++<60){ if(['assets','liabilities','equity'].indexOf(n.parent)>=0) return n.parent; if(n.parent==='pl') return (n.plkind==='expense')?'expense':'income'; const p=(b.coa||[]).find(x=>x.id===n.parent); if(!p) break; n=p; } return 'assets'; }
function acctNature(b,node){ const r=acctRoot(b,node); return (r==='assets'||r==='expense')?'D':'C'; }
function bankMatch(ref,rec){ if(!ref) return false; if(ref===rec.name) return true; const head=String(ref).split(' - ')[0].trim(); return head===rec.name; }
function bankActual(b,rec){ const R=b.records||{}; let bal=Number(rec.balance)||0;
  (R.receipts||[]).forEach(r=>{ if(bankMatch(r.receivedIn,rec)) bal+=Number(r.amount)||0; });
  (R.payments||[]).forEach(r=>{ if(bankMatch(r.paidFrom,rec)) bal-=Number(r.amount)||0; });
  (R.iat||[]).forEach(r=>{ if(bankMatch(r.receivedIn,rec)) bal+=Number(r.amount)||0; if(bankMatch(r.paidFrom,rec)) bal-=Number(r.amount)||0; });
  return bal; }
function cashTotal(b){ return ((b.records&&b.records.bankCash)||[]).reduce((a,r)=>a+bankActual(b,r),0); }
function acctNameMatches(b,id,re){ const n=acctById(b,id); return !!(n && re.test(n.name||'')); }
var AR_RE=/^accounts receivable$/i, AP_RE=/^accounts payable$/i, CAP_RE=/^capital accounts$/i, EMP_RE=/^employee clearing account$/i, INV_RE=/^inventory on hand$/i, FAC_RE=/^fixed assets, at cost$/i;
function acctIsARorAP(b,id){ return acctNameMatches(b,id,AR_RE)||acctNameMatches(b,id,AP_RE); }
function acctNeedsSub(b,id){ const n=acctById(b,id); if(!n) return false; const nm=n.name||''; return AR_RE.test(nm)||AP_RE.test(nm)||CAP_RE.test(nm)||EMP_RE.test(nm)||INV_RE.test(nm)||FAC_RE.test(nm)||SUB_EXTRA_RE.test(nm); }
var SUB_EXTRA_RE=/^(expense claims|intangible assets, at cost|investments)$/i;
// a posting line "completes" only if it has a valid account AND (if that account is a control account) a sub-account is chosen; otherwise it routes to Suspense
function lineComplete(b,ln){ if(!ln||!ln.account||!acctById(b,ln.account)) return false; if(acctNeedsSub(b,ln.account) && (ln.sub==null||ln.sub==='')) return false; return true; }
function cashLineSumSub(b,recsKey,re){ const R=b.records||{}; let s=0; (R[recsKey]||[]).forEach(r=>{ const lns=(r.lines&&r.lines.length)?r.lines:[{account:r.account,sub:r.sub,amount:r.amount}]; lns.forEach(ln=>{ if(acctNameMatches(b,ln.account,re) && ln.sub!=null && ln.sub!=='') s+=Number(ln.amount)||0; }); }); return s; }
function jrnlNetSub(b,re){ const R=b.records||{}; let s=0; (R.journal||[]).forEach(j=>{ (j.lines||[]).forEach(ln=>{ if(acctNameMatches(b,ln.account,re) && ln.sub!=null && ln.sub!=='') s+=(Number(ln.debit)||0)-(Number(ln.credit)||0); }); }); return s; }
// sum receipt/payment LINE amounts whose account matches re; optional sub-name filter
function cashLineSum(b,recsKey,re,subName){ const R=b.records||{}; let s=0;
  (R[recsKey]||[]).forEach(r=>{ const lns=(r.lines&&r.lines.length)?r.lines:[{account:r.account,sub:r.sub,amount:r.amount}];
    lns.forEach(ln=>{ if(acctNameMatches(b,ln.account,re) && (subName==null || ln.sub===subName)) s+=Number(ln.amount)||0; }); });
  return s; }
// net debit-balance (debit − credit) of journal lines matching re; optional sub filter
function jrnlNet(b,re,subName){ const R=b.records||{}; let s=0;
  (R.journal||[]).forEach(j=>{ (j.lines||[]).forEach(ln=>{ if(acctNameMatches(b,ln.account,re) && (subName==null||ln.sub===subName)) s+=(Number(ln.debit)||0)-(Number(ln.credit)||0); }); });
  return s; }
function customerBalance(b,name){ const R=b.records||{}; const c=(R.customers||[]).find(x=>x.name===name); let bal=c?Number(c.balance)||0:0;
  (R.salesInv||[]).forEach(i=>{ if(i.customer===name) bal+=Number(i.total)||0; });
  (R.creditNotes||[]).forEach(c=>{ if(c.customer===name) bal-=Number(c.total)||0; });
  bal-=cashLineSum(b,'receipts',AR_RE,name); bal+=cashLineSum(b,'payments',AR_RE,name); bal+=jrnlNet(b,AR_RE,name);
  bal-=whtForCustomer(b,name);
  (R.salesInv||[]).forEach(i=>{ if(i.customer===name) bal+=lateFeeFor(b,i); });
  return bal; }
function supplierBalance(b,name){ const R=b.records||{}; const s=(R.suppliers||[]).find(x=>x.name===name); let bal=s?Number(s.balance)||0:0;
  (R.purchInv||[]).forEach(i=>{ if(i.supplier===name) bal+=Number(i.total)||0; });
  (R.debitNotes||[]).forEach(d=>{ if(d.supplier===name) bal-=Number(d.total)||0; });
  bal-=cashLineSum(b,'payments',AP_RE,name); bal+=cashLineSum(b,'receipts',AP_RE,name); bal-=jrnlNet(b,AP_RE,name);
  return bal; }
function arMovement(b){ const R=b.records||{}; let m=0; (R.salesInv||[]).forEach(i=>{ m+=Number(i.total)||0; }); (R.creditNotes||[]).forEach(c=>{ m-=Number(c.total)||0; }); m-=cashLineSumSub(b,'receipts',AR_RE); m+=cashLineSumSub(b,'payments',AR_RE); m+=jrnlNetSub(b,AR_RE); m-=whtTotal(b); m+=lateFeesTotal(b); return m; }
function apMovement(b){ const R=b.records||{}; let m=0; (R.purchInv||[]).forEach(i=>{ m+=Number(i.total)||0; }); (R.debitNotes||[]).forEach(d=>{ m-=Number(d.total)||0; }); m-=cashLineSumSub(b,'payments',AP_RE); m+=cashLineSumSub(b,'receipts',AP_RE); m-=jrnlNetSub(b,AP_RE); return m; }
function accountMovements(b){ normalizeLineSubs(b); const mov={}; const R=b.records||{};
  const add=(id,v)=>{ if(!id||!v) return; mov[id]=(mov[id]||0)+v; };
  const credit=(id,v)=>{ const n=acctById(b,id); if(!n) return; add(id, acctNature(b,n)==='C'? v : -v); };
  const debit =(id,v)=>{ const n=acctById(b,id); if(!n) return; add(id, acctNature(b,n)==='D'? v : -v); };
  (R.receipts||[]).forEach(r=>{ const lns=(r.lines&&r.lines.length)?r.lines:[{account:r.account,amount:r.amount}]; lns.forEach(ln=>{ if(!ln.account||acctIsARorAP(b,ln.account)) return; if(acctNeedsSub(b,ln.account)&&(ln.sub==null||ln.sub==='')) return; credit(ln.account, Number(ln.amount)||0); }); });
  (R.payments||[]).forEach(r=>{ const lns=(r.lines&&r.lines.length)?r.lines:[{account:r.account,amount:r.amount}]; lns.forEach(ln=>{ if(!ln.account||acctIsARorAP(b,ln.account)) return; if(acctNeedsSub(b,ln.account)&&(ln.sub==null||ln.sub==='')) return; debit(ln.account, Number(ln.amount)||0); }); });
  (R.journal||[]).forEach(j=>{ (j.lines||[]).forEach(ln=>{ if(!ln.account) return; if(acctIsARorAP(b,ln.account)) return; if(acctNeedsSub(b,ln.account)&&(ln.sub==null||ln.sub==='')) return; debit(ln.account, Number(ln.debit)||0); credit(ln.account, Number(ln.credit)||0); }); });
  const OV=findAcct(b,'Output VAT'), IV=findAcct(b,'Input VAT');
  (R.salesInv||[]).forEach(inv=>{ const tax=Number(inv.tax)||0; const lns=inv.lines||[]; const anyAcct=lns.some(ln=>ln.account);
    if(anyAcct){ lns.forEach(ln=>{ if(ln.account) credit(ln.account, Number(ln.net!=null?ln.net:ln.amount)||0); }); }
    else if(inv.account){ credit(inv.account, Number(inv.subtotal)||0); }
    if(OV&&tax) credit(OV.id,tax); });
  (R.purchInv||[]).forEach(inv=>{ const tax=Number(inv.tax)||0; const lns=inv.lines||[]; const anyAcct=lns.some(ln=>ln.account);
    if(anyAcct){ lns.forEach(ln=>{ if(ln.account) debit(ln.account, Number(ln.net!=null?ln.net:ln.amount)||0); }); }
    else if(inv.account){ debit(inv.account, Number(inv.subtotal)||0); }
    if(IV&&tax) debit(IV.id,tax); });
  (R.creditNotes||[]).forEach(cn=>{ const tax=Number(cn.tax)||0; const lns=cn.lines||[]; const anyAcct=lns.some(ln=>ln.account);
    if(anyAcct){ lns.forEach(ln=>{ if(ln.account) debit(ln.account, Number(ln.net!=null?ln.net:ln.amount)||0); }); }
    else if(cn.account){ debit(cn.account, Number(cn.subtotal!=null?cn.subtotal:cn.total)||0); }
    if(OV&&tax) debit(OV.id,tax); });
  (R.debitNotes||[]).forEach(dn=>{ const tax=Number(dn.tax)||0; const lns=dn.lines||[]; const anyAcct=lns.some(ln=>ln.account);
    if(anyAcct){ lns.forEach(ln=>{ if(ln.account) credit(ln.account, Number(ln.net!=null?ln.net:ln.amount)||0); }); }
    else if(dn.account){ credit(dn.account, Number(dn.subtotal!=null?dn.subtotal:dn.total)||0); }
    if(IV&&tax) credit(IV.id,tax); });
  (R.payslips||[]).forEach(p=>{ const lns=p.lines||[];
    lns.forEach(ln=>{ const a=Number(ln.amount)||0; if(!a||!ln.account) return; if(ln.ptype==='Deduction') credit(ln.account,a); else debit(ln.account,a); });
    const net=Number(p.netPay!=null?p.netPay:p.total)||0; const clr=findAcct(b,'Employee clearing account'); if(clr&&net) credit(clr.id,net); });
  // ----- fixed assets: opening cost / accumulated depreciation + depreciation entries -----
  const faCost=findAcct(b,'Fixed assets, at cost'), faDep=findAcct(b,'Fixed assets, accumulated depreciation'), depExp=findAcct(b,'Depreciation');
  if(faCost||faDep){ let oc=0, od=0; (R.fixedAssets||[]).forEach(a=>{ oc+=Number(a.cost)||0; od+=Number(a.accumDep)||0; });
    if(faCost&&oc) debit(faCost.id,oc); if(faDep&&od) credit(faDep.id,od); }
  (R.depreciation||[]).forEach(dpr=>{ const lns=dpr.lines||[]; let tot=0; if(lns.length){ lns.forEach(ln=>{ tot+=Number((ln.amount!=null&&ln.amount!=='')?ln.amount:ln.depExpense)||0; }); } else tot=Number(dpr.amount)||0;
    if(tot){ if(depExp) debit(depExp.id,tot); if(faDep) credit(faDep.id,tot); } });
  // ----- capital accounts: opening (contributions/drawings post via receipt/payment lines) -----
  const capAcct=(b.coa||[]).find(x=>x.type==='account'&&/^capital accounts$/i.test(x.name||''));
  if(capAcct){ let oc=0; (R.capital||[]).forEach(c=>{ oc+=Number(c.balance)||0; }); if(oc) credit(capAcct.id,oc); }
  // ----- inventory: opening stock value + cost of goods sold (perpetual weighted average) -----
  const invOnHand=findAcct(b,'Inventory on hand'), invCost=findAcct(b,'Inventory - cost');
  if(invOnHand||invCost){ let opening=0; (R.inventory||[]).forEach(it=>{ opening+=(it.openingCost!=null&&it.openingCost!=='')?(Number(it.openingCost)||0):((Number(it.qty)||0)*(Number(it.purchasePrice)||0)); }); if(invOnHand&&opening) debit(invOnHand.id,opening);
    (R.inventory||[]).forEach(it=>{ const co=invItemMovements(b,it).cogs; if(!co) return; if(invCost) debit(invCost.id,co); if(invOnHand) credit(invOnHand.id,co); });
  }
  // ----- late payment fees: charged to the customer, earned as income -----
  { const lf=(b.lateFees||{}); if(lf.enabled && lf.account){ const acct=acctById(b,lf.account);
      if(acct){ const t=lateFeesTotal(b); if(t) credit(acct.id,t); } } }
  // ----- expense claims: line accounts debited, "Expense claims" liability credited -----
  { const claims=findAcct(b,'Expense claims');
    (R.expenseClaims||[]).forEach(c=>{ const lns=(c.lines&&c.lines.length)?c.lines:[{account:c.account,amount:c.amount}];
      let tot=0; lns.forEach(ln=>{ const a=Number(ln.amount!=null&&ln.amount!==''?ln.amount:ln.amountNoTax)||0; if(!a) return; tot+=a;
        if(ln.account && !acctIsARorAP(b,ln.account)){ if(acctNeedsSub(b,ln.account)&&(ln.sub==null||ln.sub==='')) return; debit(ln.account,a); } });
      if(claims&&tot) credit(claims.id,tot); }); }
  // ----- billable time: uninvoiced sits as an asset; write-offs go to expense -----
  { const bt=findAcct(b,'Billable time'), btm=findAcct(b,'Billable time - movement'), btw=findAcct(b,'Billable time - write-offs');
    (R.billableTime||[]).forEach(t=>{ const a=billableAmount(t); if(!a) return; const st=t.status||'Uninvoiced';
      if(st==='Uninvoiced'){ if(bt) debit(bt.id,a); if(btm) credit(btm.id,a); }
      else if(st==='Written off'){ if(btw) debit(btw.id,a); if(btm) credit(btm.id,a); } }); }
  // ----- withholding tax receipts: asset up, receivable down (AR handled via arMovement) -----
  { const wht=findAcct(b,'Withholding tax receivable'); if(wht){ const t=whtTotal(b); if(t) debit(wht.id,t); } }
  // ----- inventory write-offs: inventory value out, expense in -----
  { const invOnHand=findAcct(b,'Inventory on hand'); const dflt=findAcct(b,'Inventory write-offs');
    (R.invWriteOffs||[]).forEach(w=>{ const v=writeOffValue(b,w); if(!v) return;
      const tgt=(w.account&&acctById(b,w.account))?acctById(b,w.account):dflt; if(tgt) debit(tgt.id,v); }); }
  // ----- production orders: additional (non-inventory) cost capitalised into stock -----
  { (R.production||[]).forEach(pr=>{ const extra=Number(pr.extraCost)||0; if(!extra) return;
      const tgt=(pr.extraAccount&&acctById(b,pr.extraAccount))?acctById(b,pr.extraAccount):findAcct(b,'Production in progress');
      if(tgt) credit(tgt.id,extra); }); }
  // ----- intangible assets: opening cost / accumulated amortization + amortization entries -----
  { const iac=findAcct(b,'Intangible assets, at cost'), iaa=findAcct(b,'Intangible assets, accumulated amortization'), amx=findAcct(b,'Amortization');
    if(iac||iaa){ let oc=0, oa=0; (R.intangibles||[]).forEach(a=>{ oc+=Number(a.cost)||0; oa+=Number(a.accumAmort)||0; });
      if(iac&&oc) debit(iac.id,oc); if(iaa&&oa) credit(iaa.id,oa); }
    (R.amortization||[]).forEach(e=>{ const lns=e.lines||[]; let tot=0;
      if(lns.length) lns.forEach(ln=>{ tot+=Number((ln.amount!=null&&ln.amount!=='')?ln.amount:ln.amortExpense)||0; }); else tot=Number(e.amount)||0;
      if(tot){ if(amx) debit(amx.id,tot); if(iaa) credit(iaa.id,tot); } }); }
  // ----- investments: cost carried as an asset, revaluation to market through income -----
  { const iv=findAcct(b,'Investments'), ig=findAcct(b,'Investment gains (losses)');
    if(iv){ let oc=0; (R.investments||[]).forEach(x=>{ oc+=Number(x.cost)||0; }); if(oc) debit(iv.id,oc); }
    if(iv&&ig){ let g=0; (R.investments||[]).forEach(x=>{ g+=investGain(b,x); }); if(g){ debit(iv.id,g); credit(ig.id,g); } } }
  { const _susp=ensureSuspense(b); if(_susp){ const _pl=suspensePlug(b); if(_pl) credit(_susp.id,_pl); } }
  return mov; }
function glEntries(b, acctId){
  normalizeLineSubs(b);
  const R=b.records||{}; const acct=acctById(b,acctId); if(!acct) return {acct:null,name:'',opening:0,rows:[]};
  const nm=acct.name||''; const isAR=AR_RE.test(nm), isAP=AP_RE.test(nm), isCash=!!acct.cashControl;
  const OV=findAcct(b,'Output VAT'), IV=findAcct(b,'Input VAT'), clr=findAcct(b,'Employee clearing account');
  const faCostA=findAcct(b,'Fixed assets, at cost'), faDepA=findAcct(b,'Fixed assets, accumulated depreciation'), depExp=findAcct(b,'Depreciation');
  const capAcct=(b.coa||[]).find(x=>x.type==='account'&&CAP_RE.test(x.name||''));
  const invOnHand=findAcct(b,'Inventory on hand'), invCost=findAcct(b,'Inventory - cost');
  const rows=[]; const isId=id=>id&&String(id)===String(acctId);
  const push=(date,ref,type,debit,credit,src,id)=>{ debit=Number(debit)||0; credit=Number(credit)||0; if(!debit&&!credit) return; rows.push({date:date||'',ref:ref||'',type:type,debit:debit,credit:credit,src:src,id:id}); };
  let opening=Number(acct.balance)||0;
  if(isCash){ opening=(R.bankCash||[]).reduce((a,x)=>a+(Number(x.balance)||0),0);
    (R.receipts||[]).forEach(r=>{ if(r.receivedIn) push(r.date,r.reference,'Receipt'+(r.paidBy?' — '+r.paidBy:''),Number(r.amount)||0,0,'receipts',r.id); });
    (R.payments||[]).forEach(p=>{ if(p.paidFrom) push(p.date,p.reference,'Payment'+(p.payee?' — '+p.payee:''),0,Number(p.amount)||0,'payments',p.id); });
    (R.iat||[]).forEach(t=>{ push(t.date,t.reference,'Transfer in',Number(t.amount)||0,0,'iat',t.id); push(t.date,t.reference,'Transfer out',0,Number(t.amount)||0,'iat',t.id); });
  } else if(isAR){ opening+=custOpenings(b);
    (R.salesInv||[]).forEach(i=>push(i.issueDate||i.date,i.reference,'Sales invoice'+(i.customer?' — '+i.customer:''),Number(i.total)||0,0,'salesInv',i.id));
    (R.creditNotes||[]).forEach(c=>push(c.date,c.reference,'Credit note'+(c.customer?' — '+c.customer:''),0,Number(c.total)||0,'creditNotes',c.id));
    (R.receipts||[]).forEach(r=>{ (r.lines||[]).forEach(ln=>{ if(acctNameMatches(b,ln.account,AR_RE)&&ln.sub) push(r.date,r.reference,'Receipt'+(ln.sub?' — '+ln.sub:(r.paidBy?' — '+r.paidBy:'')),0,Number(ln.amount)||0,'receipts',r.id); }); });
    (R.payments||[]).forEach(p=>{ (p.lines||[]).forEach(ln=>{ if(acctNameMatches(b,ln.account,AR_RE)&&ln.sub) push(p.date,p.reference,'Refund'+(ln.sub?' — '+ln.sub:''),Number(ln.amount)||0,0,'payments',p.id); }); });
    (R.journal||[]).forEach(j=>{ (j.lines||[]).forEach(ln=>{ if(acctNameMatches(b,ln.account,AR_RE)&&ln.sub) push(j.date,j.reference,'Journal'+(ln.sub?' — '+ln.sub:''),Number(ln.debit)||0,Number(ln.credit)||0,'journal',j.id); }); });
  } else if(isAP){ opening+=suppOpenings(b);
    (R.purchInv||[]).forEach(i=>push(i.issueDate||i.date,i.reference,'Purchase invoice'+(i.supplier?' — '+i.supplier:''),0,Number(i.total)||0,'purchInv',i.id));
    (R.debitNotes||[]).forEach(d=>push(d.date,d.reference,'Debit note'+(d.supplier?' — '+d.supplier:''),Number(d.total)||0,0,'debitNotes',d.id));
    (R.payments||[]).forEach(p=>{ (p.lines||[]).forEach(ln=>{ if(acctNameMatches(b,ln.account,AP_RE)&&ln.sub) push(p.date,p.reference,'Payment'+(ln.sub?' — '+ln.sub:(p.payee?' — '+p.payee:'')),Number(ln.amount)||0,0,'payments',p.id); }); });
    (R.receipts||[]).forEach(r=>{ (r.lines||[]).forEach(ln=>{ if(acctNameMatches(b,ln.account,AP_RE)&&ln.sub) push(r.date,r.reference,'Refund'+(ln.sub?' — '+ln.sub:''),0,Number(ln.amount)||0,'receipts',r.id); }); });
    (R.journal||[]).forEach(j=>{ (j.lines||[]).forEach(ln=>{ if(acctNameMatches(b,ln.account,AP_RE)&&ln.sub) push(j.date,j.reference,'Journal'+(ln.sub?' — '+ln.sub:''),Number(ln.debit)||0,Number(ln.credit)||0,'journal',j.id); }); });
  } else {
    (R.receipts||[]).forEach(r=>{ const lns=(r.lines&&r.lines.length)?r.lines:[{account:r.account,amount:r.amount,sub:r.sub}]; lns.forEach(ln=>{ if(!isId(ln.account)||acctIsARorAP(b,ln.account)||(acctNeedsSub(b,ln.account)&&(ln.sub==null||ln.sub===''))) return; push(r.date,r.reference,'Receipt'+(ln.sub?' — '+ln.sub:(r.paidBy?' — '+r.paidBy:'')),0,Number(ln.amount)||0,'receipts',r.id); }); });
    (R.payments||[]).forEach(p=>{ const lns=(p.lines&&p.lines.length)?p.lines:[{account:p.account,amount:p.amount,sub:p.sub}]; lns.forEach(ln=>{ if(!isId(ln.account)||acctIsARorAP(b,ln.account)||(acctNeedsSub(b,ln.account)&&(ln.sub==null||ln.sub===''))) return; push(p.date,p.reference,'Payment'+(ln.sub?' — '+ln.sub:(p.payee?' — '+p.payee:'')),Number(ln.amount)||0,0,'payments',p.id); }); });
    (R.journal||[]).forEach(j=>{ (j.lines||[]).forEach(ln=>{ if(!isId(ln.account)||acctIsARorAP(b,ln.account)||(acctNeedsSub(b,ln.account)&&(ln.sub==null||ln.sub===''))) return; push(j.date,j.reference,'Journal'+(j.narration?' — '+j.narration:''),Number(ln.debit)||0,Number(ln.credit)||0,'journal',j.id); }); });
    (R.salesInv||[]).forEach(inv=>{ const lns=inv.lines||[]; const anyAcct=lns.some(ln=>ln.account);
      if(anyAcct){ lns.forEach(ln=>{ if(isId(ln.account)) push(inv.issueDate||inv.date,inv.reference,'Sales invoice'+(inv.customer?' — '+inv.customer:''),0,Number(ln.net!=null?ln.net:ln.amount)||0,'salesInv',inv.id); }); }
      else if(isId(inv.account)) push(inv.issueDate||inv.date,inv.reference,'Sales invoice',0,Number(inv.subtotal)||0,'salesInv',inv.id);
      if(OV&&isId(OV.id)&&Number(inv.tax)) push(inv.issueDate||inv.date,inv.reference,'Output VAT'+(inv.customer?' — '+inv.customer:''),0,Number(inv.tax)||0,'salesInv',inv.id); });
    (R.purchInv||[]).forEach(inv=>{ const lns=inv.lines||[]; const anyAcct=lns.some(ln=>ln.account);
      if(anyAcct){ lns.forEach(ln=>{ if(isId(ln.account)) push(inv.issueDate||inv.date,inv.reference,'Purchase invoice'+(inv.supplier?' — '+inv.supplier:''),Number(ln.net!=null?ln.net:ln.amount)||0,0,'purchInv',inv.id); }); }
      else if(isId(inv.account)) push(inv.issueDate||inv.date,inv.reference,'Purchase invoice',Number(inv.subtotal)||0,0,'purchInv',inv.id);
      if(IV&&isId(IV.id)&&Number(inv.tax)) push(inv.issueDate||inv.date,inv.reference,'Input VAT'+(inv.supplier?' — '+inv.supplier:''),Number(inv.tax)||0,0,'purchInv',inv.id); });
    (R.creditNotes||[]).forEach(cn=>{ const lns=cn.lines||[]; const anyAcct=lns.some(ln=>ln.account);
      if(anyAcct){ lns.forEach(ln=>{ if(isId(ln.account)) push(cn.date,cn.reference,'Credit note'+(cn.customer?' — '+cn.customer:''),Number(ln.net!=null?ln.net:ln.amount)||0,0,'creditNotes',cn.id); }); }
      else if(isId(cn.account)) push(cn.date,cn.reference,'Credit note',Number(cn.subtotal!=null?cn.subtotal:cn.total)||0,0,'creditNotes',cn.id);
      if(OV&&isId(OV.id)&&Number(cn.tax)) push(cn.date,cn.reference,'Output VAT reversal',Number(cn.tax)||0,0,'creditNotes',cn.id); });
    (R.debitNotes||[]).forEach(dn=>{ const lns=dn.lines||[]; const anyAcct=lns.some(ln=>ln.account);
      if(anyAcct){ lns.forEach(ln=>{ if(isId(ln.account)) push(dn.date,dn.reference,'Debit note'+(dn.supplier?' — '+dn.supplier:''),0,Number(ln.net!=null?ln.net:ln.amount)||0,'debitNotes',dn.id); }); }
      else if(isId(dn.account)) push(dn.date,dn.reference,'Debit note',0,Number(dn.subtotal!=null?dn.subtotal:dn.total)||0,'debitNotes',dn.id);
      if(IV&&isId(IV.id)&&Number(dn.tax)) push(dn.date,dn.reference,'Input VAT reversal',0,Number(dn.tax)||0,'debitNotes',dn.id); });
    (R.payslips||[]).forEach(p=>{ (p.lines||[]).forEach(ln=>{ const a=Number(ln.amount)||0; if(!a||!isId(ln.account)) return; if(ln.ptype==='Deduction') push(p.date,p.reference,'Payslip deduction'+(p.employee?' — '+p.employee:''),0,a,'payslips',p.id); else push(p.date,p.reference,'Payslip earning'+(p.employee?' — '+p.employee:''),a,0,'payslips',p.id); });
      if(clr&&isId(clr.id)){ const net=Number(p.netPay!=null?p.netPay:p.total)||0; if(net) push(p.date,p.reference,'Net pay'+(p.employee?' — '+p.employee:''),0,net,'payslips',p.id); } });
    if(faCostA&&isId(faCostA.id)) (R.fixedAssets||[]).forEach(a=>{ if(Number(a.cost)) push(a.acqDate||'','','Acquisition — '+(a.name||''),Number(a.cost)||0,0,'fixedAssets',a.id); });
    if(faDepA&&isId(faDepA.id)) (R.fixedAssets||[]).forEach(a=>{ if(Number(a.accumDep)) push(a.acqDate||'','','Opening accum. dep — '+(a.name||''),0,Number(a.accumDep)||0,'fixedAssets',a.id); });
    if(/^suspense$/i.test(nm)){
      (R.journal||[]).forEach(j=>{ let rd=0,rc=0; (j.lines||[]).forEach(ln=>{ if(lineComplete(b,ln)){ rd+=Number(ln.debit)||0; rc+=Number(ln.credit)||0; } }); const pl=rd-rc; if(Math.abs(pl)>0.0049) push(j.date,j.reference,'Journal out of balance'+(j.narration?' — '+j.narration:''),pl<0?-pl:0,pl>0?pl:0,'journal',j.id); });
      (R.payments||[]).forEach(r=>{ if(!(r.lines&&r.lines.length)) return; let v=0; r.lines.forEach(ln=>{ if(lineComplete(b,ln)) v+=Number(ln.amount)||0; }); const bankOk=(R.bankCash||[]).some(x=>bankMatch(r.paidFrom,x)); const pl=v-(bankOk?(Number(r.amount)||0):0); if(Math.abs(pl)>0.0049) push(r.date,r.reference,'Payment — incomplete entry'+(r.payee?' — '+r.payee:''),pl<0?-pl:0,pl>0?pl:0,'payments',r.id); });
      (R.receipts||[]).forEach(r=>{ if(!(r.lines&&r.lines.length)) return; let v=0; r.lines.forEach(ln=>{ if(lineComplete(b,ln)) v+=Number(ln.amount)||0; }); const bankOk=(R.bankCash||[]).some(x=>bankMatch(r.receivedIn,x)); const pl=(bankOk?(Number(r.amount)||0):0)-v; if(Math.abs(pl)>0.0049) push(r.date,r.reference,'Receipt — incomplete entry'+(r.paidBy?' — '+r.paidBy:''),pl<0?-pl:0,pl>0?pl:0,'receipts',r.id); });
    }
    (R.depreciation||[]).forEach(dpr=>{ const lns=dpr.lines||[]; let tot=0; if(lns.length){ lns.forEach(ln=>{ tot+=Number((ln.amount!=null&&ln.amount!=='')?ln.amount:ln.depExpense)||0; }); } else tot=Number(dpr.amount)||0; if(!tot) return; if(depExp&&isId(depExp.id)) push(dpr.date,dpr.reference,'Depreciation',tot,0,'depreciation',dpr.id); if(faDepA&&isId(faDepA.id)) push(dpr.date,dpr.reference,'Depreciation',0,tot,'depreciation',dpr.id); });
    if(capAcct&&isId(capAcct.id)) (R.capital||[]).forEach(c=>{ if(Number(c.balance)) push('','','Opening capital — '+(c.name||''),0,Number(c.balance)||0,'capital',c.id); });
    if(invOnHand&&isId(invOnHand.id)){ (R.inventory||[]).forEach(it=>{ const op=(it.openingCost!=null&&it.openingCost!=='')?(Number(it.openingCost)||0):((Number(it.qty)||0)*(Number(it.purchasePrice)||0)); if(op) push('','','Opening stock — '+(it.name||''),op,0,'inventory',it.id); });
      (R.inventory||[]).forEach(it=>{ invItemMovements(b,it).rows.forEach(r=>{ if(r.src==='salesInv'&&r.cout>0.0000001) push(r.date,r.ref,'Cost of sales — '+(it.name||''),0,r.cout,'salesInv',r.id); }); }); }
    if(invCost&&isId(invCost.id)){ (R.inventory||[]).forEach(it=>{ invItemMovements(b,it).rows.forEach(r=>{ if(r.src==='salesInv'&&r.cout>0.0000001) push(r.date,r.ref,'Cost of sales — '+(it.name||''),r.cout,0,'salesInv',r.id); }); }); }
  }
  rows.sort((x,y)=>String(x.date||'').localeCompare(String(y.date||''))||String(x.ref||'').localeCompare(String(y.ref||'')));
  return {acct, name:nm, opening, rows};
}
function custOpenings(b){ return ((b.records&&b.records.customers)||[]).reduce((a,c)=>a+(Number(c.balance)||0),0); }
function suppOpenings(b){ return ((b.records&&b.records.suppliers)||[]).reduce((a,c)=>a+(Number(c.balance)||0),0); }
function employeeBalance(b,name){ const R=b.records||{}; let bal=0;
  (R.payslips||[]).forEach(p=>{ if(p.employee===name) bal+=Number(p.netPay!=null?p.netPay:p.total)||0; });
  bal-=cashLineSum(b,'payments',EMP_RE,name); bal+=cashLineSum(b,'receipts',EMP_RE,name); bal-=jrnlNet(b,EMP_RE,name);
  return bal; }
function capitalBalance(b,name){ const R=b.records||{}; let bal=0;
  (R.capital||[]).forEach(c=>{ if(c.name===name) bal+=Number(c.balance)||0; });
  bal+=cashLineSum(b,'receipts',CAP_RE,name); bal-=cashLineSum(b,'payments',CAP_RE,name); bal-=jrnlNet(b,CAP_RE,name);
  return bal; }
function ensureCapitalControl(b){ if(!b.coa) return null; const R=b.records||{};
  const has=(R.capital&&R.capital.length)||(R.receipts||[]).some(r=>r.capitalAcc)||(R.payments||[]).some(p=>p.capitalAcc);
  if(!has) return null;
  let n=(b.coa||[]).find(x=>x.type==='account'&&/^capital accounts$/i.test(x.name||''));
  if(!n){ n={id:'a'+Math.random().toString(36).slice(2,9),type:'account',name:'Capital accounts',code:'',parent:'equity',balance:0,control:1}; b.coa.push(n); }
  n.control=1; n.capControl=1; return n; }
function liveBalance(b,node,mov){ if(node.cashControl) return cashTotal(b); if(node.arControl) return (Number(node.balance)||0)+custOpenings(b)+arMovement(b); if(node.apControl) return (Number(node.balance)||0)+suppOpenings(b)+apMovement(b); mov=mov||accountMovements(b); return (Number(node.balance)||0)+(mov[node.id]||0); }
function flagControls(b){ if(!b.coa) return; b.coa.forEach(n=>{ if(n.type!=='account') return; if(/^accounts receivable$/i.test(n.name||'')){ n.arControl=1; n.control=1; } if(/^accounts payable$/i.test(n.name||'')){ n.apControl=1; n.control=1; } }); }
function ensureSubledgerControls(b){ if(!b.coa) return; const R=b.records||{};
  if((R.customers||[]).length || (R.salesInv||[]).length || (R.creditNotes||[]).length) ensureControl(b,'Accounts receivable','assets');
  if((R.suppliers||[]).length || (R.purchInv||[]).length || (R.debitNotes||[]).length) ensureControl(b,'Accounts payable','liabilities');
  if((R.employees||[]).length || (R.payslips||[]).length) ensureControl(b,'Employee clearing account','liabilities'); }
function ensureControl(b,name,section){ if(!b.coa) return null; let n=findAcct(b,name); if(!n){ n={id:'a'+Math.random().toString(36).slice(2,9),type:'account',name:name,code:'',parent:section,balance:0}; b.coa.push(n); } n.control=1; if(/^accounts receivable$/i.test(name)) n.arControl=1; if(/^accounts payable$/i.test(name)) n.apControl=1; return n; }
function plInsertTop(b,id){ b.coaTop=b.coaTop||{bs:['assets','liabilities','equity'],pl:[]}; b.coaTop.pl=b.coaTop.pl||[]; if(b.coaTop.pl.indexOf(id)>=0) return; const ti=b.coaTop.pl.findIndex(x=>{ const n=(b.coa||[]).find(y=>y.id===x); return n&&n.type==='total'; }); if(ti<0) b.coaTop.pl.push(id); else b.coaTop.pl.splice(ti,0,id); }
function ensureInventoryAccounts(b){ if(!b.coa) return; const R=b.records||{};
  if(!(R.inventory&&R.inventory.length)) return;
  const rnd=()=>Math.random().toString(36).slice(2,9);
  let incG=(b.coa||[]).find(n=>n.type==='group'&&n.plkind==='income');
  if(!incG){ incG={id:'gInc'+rnd(),type:'group',name:'Income',code:'',parent:'pl',plkind:'income'}; b.coa.push(incG); plInsertTop(b,incG.id); }
  if(!findAcct(b,'Inventory - sales')) b.coa.push({id:'a'+rnd(),type:'account',name:'Inventory - sales',code:'',parent:incG.id,balance:0});
  let expG=(b.coa||[]).find(n=>n.type==='group'&&n.plkind==='expense');
  if(!expG){ expG={id:'gExp'+rnd(),type:'group',name:'Expenses',code:'',parent:'pl',plkind:'expense'}; b.coa.push(expG); plInsertTop(b,expG.id); }
  if(!findAcct(b,'Inventory - cost')) b.coa.push({id:'a'+rnd(),type:'account',name:'Inventory - cost',code:'',parent:expG.id,balance:0});
  if(!findAcct(b,'Inventory on hand')) b.coa.push({id:'a'+rnd(),type:'account',name:'Inventory on hand',code:'',parent:'assets',balance:0,control:1}); }
function ensureFixedAssetAccounts(b){ if(!b.coa) return; const R=b.records||{};
  if(!(R.fixedAssets&&R.fixedAssets.length)) return;
  const rnd=()=>Math.random().toString(36).slice(2,9);
  if(!findAcct(b,'Fixed assets, at cost')) b.coa.push({id:'a'+rnd(),type:'account',name:'Fixed assets, at cost',code:'',parent:'assets',balance:0,control:1});
  if(!findAcct(b,'Fixed assets, accumulated depreciation')) b.coa.push({id:'a'+rnd(),type:'account',name:'Fixed assets, accumulated depreciation',code:'',parent:'assets',balance:0,control:1});
  let expG=(b.coa||[]).find(n=>n.type==='group'&&n.plkind==='expense');
  if(!expG){ expG={id:'gExp'+rnd(),type:'group',name:'Expenses',code:'',parent:'pl',plkind:'expense'}; b.coa.push(expG); plInsertTop(b,expG.id); }
  if(!findAcct(b,'Depreciation')) b.coa.push({id:'a'+rnd(),type:'account',name:'Depreciation',code:'',parent:expG.id,balance:0}); }
function _plGroup(b,kind,name){ const rnd=()=>Math.random().toString(36).slice(2,9);
  let g=(b.coa||[]).find(n=>n.type==='group'&&n.plkind===kind);
  if(!g){ g={id:'g'+kind+rnd(),type:'group',name:name||(kind==='income'?'Income':'Expenses'),code:'',parent:'pl',plkind:kind}; b.coa.push(g); plInsertTop(b,g.id); }
  return g; }
function _mkAcct(b,name,parent,opts){ if(findAcct(b,name)) return findAcct(b,name);
  const n=Object.assign({id:'a'+Math.random().toString(36).slice(2,9),type:'account',name:name,code:'',parent:parent,balance:0}, opts||{});
  b.coa.push(n); return n; }
function ensureExpenseClaimAccounts(b){ if(!b.coa) return; const R=b.records||{};
  if(!(R.expenseClaims&&R.expenseClaims.length)) return;
  _mkAcct(b,'Expense claims','liabilities',{control:1}); }
function ensureBillableTimeAccounts(b){ if(!b.coa) return; const R=b.records||{};
  if(!(R.billableTime&&R.billableTime.length)) return;
  _mkAcct(b,'Billable time','assets',{control:1});
  _mkAcct(b,'Billable time - movement', _plGroup(b,'income').id);
  _mkAcct(b,'Billable time - write-offs', _plGroup(b,'expense').id); }
function ensureWhtAccounts(b){ if(!b.coa) return; const R=b.records||{};
  if(!(R.whtReceipts&&R.whtReceipts.length)) return;
  _mkAcct(b,'Withholding tax receivable','assets'); }
function ensureIntangibleAccounts(b){ if(!b.coa) return; const R=b.records||{};
  if(!((R.intangibles&&R.intangibles.length)||(R.amortization&&R.amortization.length))) return;
  _mkAcct(b,'Intangible assets, at cost','assets',{control:1});
  _mkAcct(b,'Intangible assets, accumulated amortization','assets',{control:1});
  _mkAcct(b,'Amortization', _plGroup(b,'expense').id); }
function ensureInvestmentAccounts(b){ if(!b.coa) return; const R=b.records||{};
  if(!(R.investments&&R.investments.length)) return;
  _mkAcct(b,'Investments','assets',{control:1});
  _mkAcct(b,'Investment gains (losses)', _plGroup(b,'income').id); }
function ensureProductionAccounts(b){ if(!b.coa) return; const R=b.records||{};
  if(!(R.production&&R.production.length)) return;
  _mkAcct(b,'Production in progress', _plGroup(b,'expense').id); }
function ensureWriteOffAccounts(b){ if(!b.coa) return; const R=b.records||{};
  if(!(R.invWriteOffs&&R.invWriteOffs.length)) return;
  _mkAcct(b,'Inventory write-offs', _plGroup(b,'expense').id); }
function ensureAllControls(b){ try{
    ensureExpenseClaimAccounts(b); ensureBillableTimeAccounts(b); ensureWhtAccounts(b);
    ensureIntangibleAccounts(b); ensureInvestmentAccounts(b); ensureProductionAccounts(b); ensureWriteOffAccounts(b);
  }catch(e){} }
function faDeprFor(b,asset){ const R=b.records||{}; const name=asset&&asset.name; let s=0;
  (R.depreciation||[]).forEach(d=>{ (d.lines||[]).forEach(ln=>{ if(ln.asset===name) s+=Number((ln.amount!=null&&ln.amount!=='')?ln.amount:ln.depExpense)||0; }); }); return s; }
function faAccumDepExcl(b,asset,exclId){ const R=b.records||{}; const name=asset&&asset.name; let s=Number(asset&&asset.accumDep)||0;
  (R.depreciation||[]).forEach(d=>{ if(exclId!=null && d.id===exclId) return; (d.lines||[]).forEach(ln=>{ if(ln.asset===name) s+=Number((ln.amount!=null&&ln.amount!=='')?ln.amount:ln.depExpense)||0; }); }); return s; }
function faAccumDep(b,asset){ return (Number(asset&&asset.accumDep)||0)+faDeprFor(b,asset); }
function faCashAdd(b,asset){ return cashLineSum(b,'payments',FAC_RE,asset&&asset.name)-cashLineSum(b,'receipts',FAC_RE,asset&&asset.name)+jrnlNet(b,FAC_RE,asset&&asset.name); }
function faCost(b,asset){ return (Number(asset&&asset.cost)||0)+faCashAdd(b,asset); }
function faBookValue(b,asset){ return faCost(b,asset)-faAccumDep(b,asset); }
function invItemMovements(b,item){ const R=b.records||{}; const name=item&&item.name;
  const startQty=Number(item&&item.qty)||0; var _ocR=(item&&item.openingCost); var _ocSet=(_ocR!=null&&_ocR!==''); const startVal=_ocSet?(Number(_ocR)||0):(startQty*(Number(item&&item.purchasePrice)||0)); const startCost=startQty>0?startVal/startQty:(Number(item&&item.purchasePrice)||0); const ev=[];
  (R.purchInv||[]).forEach(d=>{ (d.lines||[]).forEach(ln=>{ if(ln.item===name){ const q=Number(ln.qty)||0; if(q){ const val=(ln.net!=null?Number(ln.net):q*(Number(ln.price)||0)); ev.push({date:d.issueDate||d.date,ref:d.reference,buy:1,q:q,val:val,party:d.supplier,src:'purchInv',id:d.id}); } } }); });
  (R.salesInv||[]).forEach(d=>{ (d.lines||[]).forEach(ln=>{ if(ln.item===name){ const q=Number(ln.qty)||0; if(q){ ev.push({date:d.issueDate||d.date,ref:d.reference,buy:0,q:q,party:d.customer,src:'salesInv',id:d.id}); } } }); });
  (R.payments||[]).forEach(d=>{ (d.lines||[]).forEach(ln=>{ if(ln.sub===name && acctNameMatches(b,ln.account,INV_RE)){ const val=Number(ln.amount)||0; if(val) ev.push({date:d.date,ref:d.reference,adj:val,party:d.payee,src:'payments',id:d.id}); } }); });
  (R.receipts||[]).forEach(d=>{ (d.lines||[]).forEach(ln=>{ if(ln.sub===name && acctNameMatches(b,ln.account,INV_RE)){ const val=Number(ln.amount)||0; if(val) ev.push({date:d.date,ref:d.reference,adj:-val,party:d.paidBy,src:'receipts',id:d.id}); } }); });
  (R.journal||[]).forEach(d=>{ (d.lines||[]).forEach(ln=>{ if(ln.sub===name && acctNameMatches(b,ln.account,INV_RE)){ const adj=(Number(ln.debit)||0)-(Number(ln.credit)||0); if(adj) ev.push({date:d.date,ref:d.reference,adj:adj,lbl:'Journal entry',src:'journal',id:d.id}); } }); });
  (R.salesInv||[]).forEach(d=>{ (d.lines||[]).forEach(ln=>{ const comps=kitComponents(b,ln.item); if(!comps) return;
    const kq=Number(ln.qty)||0; if(!kq) return;
    comps.forEach(c=>{ if(c.item!==name) return; const q=kq*(Number(c.qty)||0); if(q)
      ev.push({date:d.issueDate||d.date,ref:d.reference,buy:0,q:q,lbl:'Kit — '+(ln.item||''),src:'salesInv',id:d.id}); }); }); });
  (R.invWriteOffs||[]).forEach(d=>{ (d.lines||[]).forEach(ln=>{ if(ln.item===name){ const q=Number(ln.qty)||0; if(q) ev.push({date:d.date,ref:d.reference,buy:0,q:q,lbl:'Inventory write-off',src:'invWriteOffs',id:d.id}); } }); });
  (R.production||[]).forEach(d=>{ (d.lines||[]).forEach(ln=>{ if(ln.item===name){ const q=Number(ln.qty)||0; if(q) ev.push({date:d.date,ref:d.reference,buy:0,q:q,lbl:'Production order — materials',src:'production',id:d.id}); } });
    if(d.item===name){ const q=Number(d.qty)||0; if(q){ const val=productionCost(b,d); ev.push({date:d.date,ref:d.reference,buy:1,q:q,val:val,lbl:'Production order — finished goods',src:'production',id:d.id}); } } });
  ev.sort((x,y)=>String(x.date||'').localeCompare(String(y.date||''))||String(x.ref||'').localeCompare(String(y.ref||'')));
  let qty=startQty, value=startVal, lastAvg=qty>0?value/qty:startCost, cogs=0;
  const rows=[{opening:1,type:'Starting balance',qin:startQty,qout:0,cin:value,cout:0,qbal:qty,cbal:value,src:'',id:null}];
  ev.forEach(e=>{ if(e.adj!=null){ value+=e.adj; if(qty>0) lastAvg=value/qty;
      rows.push({date:e.date,ref:e.ref,type:e.lbl?e.lbl:((e.adj>=0?'Cash purchase':'Cash sale')+(e.party?' — '+e.party:'')),qin:0,qout:0,cin:e.adj>0?e.adj:0,cout:e.adj<0?-e.adj:0,qbal:qty,cbal:value,src:e.src,id:e.id}); }
    else if(e.buy){ qty+=e.q; value+=e.val; if(qty>0) lastAvg=value/qty;
      rows.push({date:e.date,ref:e.ref,type:e.lbl||('Purchase invoice'+(e.party?' — '+e.party:'')),qin:e.q,qout:0,cin:e.val,cout:0,qbal:qty,cbal:value,src:e.src,id:e.id}); }
    else { const avg=qty>0?value/qty:lastAvg; const co=e.q*avg; cogs+=co; qty-=e.q; value-=co;
      rows.push({date:e.date,ref:e.ref,type:e.lbl||('Sales invoice'+(e.party?' — '+e.party:'')),qin:0,qout:e.q,cin:0,cout:co,qbal:qty,cbal:value,src:e.src,id:e.id}); } });
  const avgCost=qty>0?value/qty:lastAvg;
  return {rows,qtyOnHand:Math.round(qty*1e6)/1e6,totalValue:Math.round(value*1e6)/1e6,avgCost,cogs,startQty,startCost}; }
/* ---------- inventory kits ---------- */
function kitComponents(b,name){ if(!name) return null;
  const k=((b&&b.inventoryKits)||[]).find(x=>x&&x.name===name);
  return (k&&k.items&&k.items.length)?k.items:null; }
function kitCostOf(b,name){ const comps=kitComponents(b,name); if(!comps) return 0;
  return Math.round(comps.reduce((a,c)=>a+(Number(c.qty)||0)*invAvgCostByName(b,c.item),0)*100)/100; }

/* ---------- late payment fees ---------- */
function lateFeeFor(b,inv,asOf){ const cfg=(b&&b.lateFees)||{}; if(!cfg.enabled) return 0;
  if(!inv||!inv.lateFees) return 0;                       // opt in per invoice, as Manager does
  const due=String(inv.dueDate||'').slice(0,10); if(!due) return 0;
  const bal=Number(inv.balanceDue!=null?inv.balanceDue:inv.total)||0; if(bal<=0.005) return 0;
  const today=String(asOf||new Date().toISOString().slice(0,10)).slice(0,10);
  const P=v=>{ const m=String(v||'').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m?Date.UTC(+m[1],+m[2]-1,+m[3]):NaN; };
  const t=P(today), dd=P(due); if(isNaN(t)||isNaN(dd)) return 0;
  let days=Math.round((t-dd)/86400000);
  days-=(Number(cfg.grace)||0); if(days<=0) return 0;
  const rate=(Number(cfg.rate)||0)/100; if(!rate) return 0;
  let fee;
  if(cfg.period==='once') fee=bal*rate;
  else if(cfg.period==='year') fee=bal*rate*(days/365);
  else fee=bal*rate*(days/30);
  return Math.round(fee*100)/100; }
function lateFeesTotal(b,asOf){ return ((b.records&&b.records.salesInv)||[]).reduce((a,i)=>a+lateFeeFor(b,i,asOf),0); }

/* ---------- expense claims ---------- */
var EXPCLAIM_RE=/^expense claims$/i, BILLT_RE=/^billable time$/i, WHT_RE=/^withholding tax receivable$/i,
    IAC_RE=/^intangible assets, at cost$/i, IAA_RE=/^intangible assets, accumulated amortization$/i, INVEST_RE=/^investments$/i;
function claimTotal(rec){ const lns=(rec&&rec.lines)||[]; if(lns.length) return lns.reduce((a,ln)=>a+(Number(ln.amount!=null&&ln.amount!==''?ln.amount:ln.amountNoTax)||0),0); return Number(rec&&rec.amount)||0; }
function claimPayerBalance(b,name){ const R=b.records||{}; let bal=0;
  (R.expenseClaims||[]).forEach(c=>{ if((c.payer||'')===name) bal+=claimTotal(c); });
  bal-=cashLineSum(b,'payments',EXPCLAIM_RE,name); bal+=cashLineSum(b,'receipts',EXPCLAIM_RE,name); bal-=jrnlNet(b,EXPCLAIM_RE,name);
  return bal; }

/* ---------- billable time ---------- */
function billableAmount(rec){ if(rec&&rec.amount!=null&&rec.amount!=='') return Number(rec.amount)||0;
  return (Number(rec&&rec.hours)||0)*(Number(rec&&rec.rate)||0); }
function billableByStatus(b,status){ const R=b.records||{}; let s=0;
  (R.billableTime||[]).forEach(t=>{ if((t.status||'Uninvoiced')===status) s+=billableAmount(t); }); return s; }
function billableCustomer(b,name,status){ const R=b.records||{}; let s=0;
  (R.billableTime||[]).forEach(t=>{ if((t.customer||'')!==name) return; if(status&&(t.status||'Uninvoiced')!==status) return; s+=billableAmount(t); }); return s; }

/* ---------- withholding tax ---------- */
function whtTotal(b){ return ((b.records&&b.records.whtReceipts)||[]).reduce((a,r)=>a+(Number(r.amount)||0),0); }
function whtForCustomer(b,name){ return ((b.records&&b.records.whtReceipts)||[]).reduce((a,r)=>a+(((r.customer||'')===name)?(Number(r.amount)||0):0),0); }

/* ---------- inventory transfers / write-offs / production ---------- */
function lineQtyTotal(rec){ return ((rec&&rec.lines)||[]).reduce((a,ln)=>a+(Number(ln.qty)||0),0); }
function invAvgCostByName(b,name){ const it=((b.records&&b.records.inventory)||[]).find(x=>x.name===name); if(!it) return 0;
  const m=invItemMovements(b,it); return m.avgCost||0; }
function _invUnitCostAt(b,name,exclude){ const it=((b.records&&b.records.inventory)||[]).find(x=>x.name===name); if(!it) return 0;
  const startQty=Number(it.qty)||0; var _oc=it.openingCost; const startVal=(_oc!=null&&_oc!=='')?(Number(_oc)||0):(startQty*(Number(it.purchasePrice)||0));
  let qty=startQty, val=startVal;
  ((b.records&&b.records.purchInv)||[]).forEach(d=>{ (d.lines||[]).forEach(ln=>{ if(ln.item!==name) return; const q=Number(ln.qty)||0; if(!q) return;
    qty+=q; val+=(ln.net!=null?Number(ln.net):q*(Number(ln.price)||0)); }); });
  if(qty>0) return val/qty; return Number(it.purchasePrice)||0; }
function writeOffValue(b,rec){ let v=0; ((rec&&rec.lines)||[]).forEach(ln=>{ const q=Number(ln.qty)||0; if(!q) return;
  const unit=(ln.unitCost!=null&&ln.unitCost!=='')?Number(ln.unitCost):_invUnitCostAt(b,ln.item); v+=q*(unit||0); }); return Math.round(v*100)/100; }
function productionCost(b,rec){ let v=Number(rec&&rec.extraCost)||0;
  ((rec&&rec.lines)||[]).forEach(ln=>{ const q=Number(ln.qty)||0; if(!q) return;
    const unit=(ln.unitCost!=null&&ln.unitCost!=='')?Number(ln.unitCost):_invUnitCostAt(b,ln.item); v+=q*(unit||0); });
  return Math.round(v*100)/100; }
function invQtyByLocation(b,loc){ const out={}; const R=b.records||{};
  (R.invTransfers||[]).forEach(t=>{ (t.lines||[]).forEach(ln=>{ const q=Number(ln.qty)||0; if(!q||!ln.item) return;
    if((t.toLocation||'')===loc) out[ln.item]=(out[ln.item]||0)+q;
    if((t.fromLocation||'')===loc) out[ln.item]=(out[ln.item]||0)-q; }); });
  return out; }

/* ---------- intangible assets ---------- */
function iaAmortFor(b,asset){ const R=b.records||{}; const name=asset&&asset.name; let s=0;
  (R.amortization||[]).forEach(e=>{ (e.lines||[]).forEach(ln=>{ if(ln.asset===name) s+=Number((ln.amount!=null&&ln.amount!=='')?ln.amount:ln.amortExpense)||0; }); }); return s; }
function iaAccumAmortExcl(b,asset,exclId){ const R=b.records||{}; const name=asset&&asset.name; let s=Number(asset&&asset.accumAmort)||0;
  (R.amortization||[]).forEach(e=>{ if(exclId!=null&&e.id===exclId) return; (e.lines||[]).forEach(ln=>{ if(ln.asset===name) s+=Number((ln.amount!=null&&ln.amount!=='')?ln.amount:ln.amortExpense)||0; }); }); return s; }
function iaAccumAmort(b,asset){ return (Number(asset&&asset.accumAmort)||0)+iaAmortFor(b,asset); }
function iaCashAdd(b,asset){ return cashLineSum(b,'payments',IAC_RE,asset&&asset.name)-cashLineSum(b,'receipts',IAC_RE,asset&&asset.name)+jrnlNet(b,IAC_RE,asset&&asset.name); }
function iaCost(b,asset){ return (Number(asset&&asset.cost)||0)+iaCashAdd(b,asset); }
function iaBookValue(b,asset){ return iaCost(b,asset)-iaAccumAmort(b,asset); }

/* ---------- investments ---------- */
function investCost(b,rec){ return (Number(rec&&rec.cost)||0)
  + cashLineSum(b,'payments',INVEST_RE,rec&&rec.name) - cashLineSum(b,'receipts',INVEST_RE,rec&&rec.name) + jrnlNet(b,INVEST_RE,rec&&rec.name); }
function investMarketValue(rec){ if(rec&&rec.marketValue!=null&&rec.marketValue!=='') return Number(rec.marketValue)||0;
  return (Number(rec&&rec.qty)||0)*(Number(rec&&rec.marketPrice)||0); }
function investGain(b,rec){ const mv=investMarketValue(rec); if(!mv) return 0; return Math.round((mv-investCost(b,rec))*100)/100; }

function invItemStats(b,item){ const m=invItemMovements(b,item); return {qtyOnHand:m.qtyOnHand,avgCost:m.avgCost,totalCost:m.totalValue,cogs:m.cogs,startQty:m.startQty}; }
function invoiceCogs(b,invId){ let c=0; ((b.records&&b.records.inventory)||[]).forEach(it=>{ invItemMovements(b,it).rows.forEach(r=>{ if(r.src==='salesInv'&&r.id===invId) c+=r.cout; }); }); return c; }
function ensureCashControl(b){ if(!b.coa) return null;
  let n=b.coa.find(x=>x.cashControl); if(n){ n.balance=0; n.control=1; return n; }
  n=b.coa.find(x=>x.type==='account'&&/^cash & cash equivalents$/i.test(x.name||''));
  if(n){ n.cashControl=1; n.control=1; n.balance=0; return n; }
  n={id:'a'+Math.random().toString(36).slice(2,9),type:'account',name:'Cash & cash equivalents',code:'',parent:'assets',balance:0,control:1,cashControl:1};
  b.coa.push(n); return n; }
function ensureSuspense(b){ if(!b.coa) return null; const R=b.records||{};
  let n=(b.coa||[]).find(x=>x.type==='account'&&/^suspense$/i.test(x.name||''));
  if(!n){ if(!((R.journal&&R.journal.length) || Math.abs(suspensePlug(b))>0.0049)) return null; n={id:'aSusp'+Math.random().toString(36).slice(2,6),type:'account',name:'Suspense',code:'',parent:'equity',balance:0}; b.coa.push(n); }
  n.suspenseControl=1; return n; }
function suspensePlug(b){ const R=b.records||{}; let p=0;
  (R.journal||[]).forEach(j=>{ let rd=0,rc=0; (j.lines||[]).forEach(ln=>{ if(lineComplete(b,ln)){ rd+=Number(ln.debit)||0; rc+=Number(ln.credit)||0; } }); p+=(rd-rc); });
  (R.payments||[]).forEach(r=>{ if(!(r.lines&&r.lines.length)) return; let v=0; r.lines.forEach(ln=>{ if(lineComplete(b,ln)) v+=Number(ln.amount)||0; }); const bankOk=(R.bankCash||[]).some(x=>bankMatch(r.paidFrom,x)); const cr=bankOk?(Number(r.amount)||0):0; p+=(v-cr); });
  (R.receipts||[]).forEach(r=>{ if(!(r.lines&&r.lines.length)) return; let v=0; r.lines.forEach(ln=>{ if(lineComplete(b,ln)) v+=Number(ln.amount)||0; }); const bankOk=(R.bankCash||[]).some(x=>bankMatch(r.receivedIn,x)); const dr=bankOk?(Number(r.amount)||0):0; p+=(dr-v); });
  return Math.round(p*1e6)/1e6; }
function acctName(b,id){ const n=acctById(b,id); return n? (n.name+(n.code?' ('+n.code+')':'')) : (id||''); }
function acctPath(b,node){ const parts=[node.name]; let p=node.parent,g=0; while(p&&['assets','liabilities','equity','pl'].indexOf(p)<0&&g++<60){ const x=acctById(b,p); if(!x)break; parts.unshift(x.name); p=x.parent; } return parts.join(' › '); }

function summaryFromCoa(b){
  const T=b.coaSections||{assets:'Assets',liabilities:'Liabilities',equity:'Equity'}; const sc=k=>k.amt!=null?k.amt:(k.total||0);
  const mov=accountMovements(b);
  const build=n=>{ if(n.type==='group'){ const kids=b.coa.filter(x=>x.parent===n.id).map(build); return {id:n.id,name:n.name,total:kids.reduce((a,k)=>a+sc(k),0),children:kids}; } return {id:n.id,name:n.name,amt:liveBalance(b,n,mov)}; };
  const kidsOf=key=>b.coa.filter(x=>x.parent===key).map(build); const sum=arr=>arr.reduce((a,k)=>a+sc(k),0);
  const pl=[]; ((b.coaTop&&b.coaTop.pl)||[]).forEach(id=>{ const n=(b.coa||[]).find(x=>x.id===id); if(n&&n.type==='group'){ const kids=b.coa.filter(x=>x.parent===n.id).map(build); pl.push({title:n.name,total:kids.reduce((a,k)=>a+sc(k),0),children:kids,plkind:n.plkind}); } });
  const plNet=pl.reduce((a,g)=>a+((g.plkind==='expense'?-1:1)*(g.total||0)),0);
  const aKids=kidsOf('assets'), lKids=kidsOf('liabilities'), eKids=kidsOf('equity');
  const aTot=sum(aKids), lTot=sum(lKids), eBase=sum(eKids);
  const sbe=aTot - lTot - eBase - plNet; // offset for opening balances → keeps the sheet balanced
  const eChildren=eKids.slice();
  if(Math.abs(plNet)>0.0049) eChildren.push({name:'Net profit (loss)',amt:plNet});
  if(Math.abs(sbe)>0.0049) eChildren.push({name:'Starting balance equity',amt:sbe});
  const bs=[{title:T.assets,total:aTot,children:aKids},{title:T.liabilities,total:lTot,children:lKids},{title:T.equity,total:eBase+plNet+sbe,children:eChildren}];
  return {balanceSheet:bs, profitLoss:pl};
}
function normalizeLineSubs(b){ if(!b||b._subsNormalized) return; if(b.records){ ['receipts','payments','journal','salesInv','purchInv','creditNotes','debitNotes'].forEach(function(k){ (b.records[k]||[]).forEach(function(r){ (r.lines||[]).forEach(function(ln){ if((ln.sub==null||ln.sub==='')&&ln.subAccount!=null&&ln.subAccount!==''){ ln.sub=ln.subAccount; } }); }); }); } b._subsNormalized=1; }
function refreshSummary(b){ if(!b.coa) return; normalizeLineSubs(b); ensureAllControls(b); const s=summaryFromCoa(b); b.balanceSheet=s.balanceSheet; b.profitLoss=s.profitLoss; }
