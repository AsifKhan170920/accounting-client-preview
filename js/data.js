/* ===================== persistence ===================== */
const DB = {
  k:{accounts:'mgr_accounts', session:'mgr_session', biz:'mgr_businesses', users:'mgr_users'},
  get(key,def){ try{ return JSON.parse(localStorage.getItem(key)) ?? def }catch(e){ return def } },
  set(key,val){ localStorage.setItem(key, JSON.stringify(val)) },
};

/* sidebar definition: [icon, label, registerKey] */
const SIDEBAR = [
  ['📊','Summary',null],['🏦','Bank and Cash Accounts','bankCash'],['🧾','Receipts','receipts'],
  ['💳','Payments','payments'],['🔁','Inter Account Transfers','iat'],['☑️','Bank Reconciliations','bankRec'],
  ['👤','Customers','customers'],['🗒️','Sales Quotes','salesQuotes'],['📑','Sales Orders','salesOrders'],
  ['🧾','Sales Invoices','salesInv'],['📄','Credit Notes','creditNotes'],['🚛','Delivery Notes','deliveryNotes'],['🚚','Suppliers','suppliers'],
  ['🗒️','Purchase Quotes','purchQuotes'],['📑','Purchase Orders','purchOrders'],['🧾','Purchase Invoices','purchInv'],
  ['📄','Debit Notes','debitNotes'],['📦','Goods Receipts','goodsRec'],['🏷️','Inventory Items','inventory'],
  ['🧑','Employees','employees'],['💵','Payslips','payslips'],['🏗️','Fixed Assets','fixedAssets'],
  ['📉','Depreciation Entries','depreciation'],['🏛️','Capital Accounts','capital'],['⭐','Special Accounts','special'],
  ['📚','Journal Entries','journal'],
];
const SIDEBAR_FOOT = [['📈','Reports'],['⚙️','Settings']];
const LABEL2KEY = {}; SIDEBAR.forEach(([i,l,k])=>{ if(k) LABEL2KEY[l]=k; });
const KEY2LABEL = {}; Object.keys(LABEL2KEY).forEach(l=>{ if(!KEY2LABEL[LABEL2KEY[l]]) KEY2LABEL[LABEL2KEY[l]]=l; });

/* ===================== register configs =====================
   col kinds: text | date | money | ref ; col opts: r(right), color('blue'), bold, calc(fn)
   form types: text | date | money | number | select(options) | ref(from) | textarea           */
const CUR=['AED','USD','EUR','GBP','SAR','PKR','INR'];
const INV_OPTS_FORM=[
  {key:'colLineNum',label:'Column — Line number',type:'check'},{key:'showDescCol',label:'Column — Description',type:'check'},{key:'colDiscount',label:'Column — Discount',type:'check'},
  {key:'taxInclusive',label:'Amounts are tax inclusive',type:'check'},{key:'rounding',label:'Rounding',type:'check'},
  {key:'earlyPay',label:'Early payment discount',type:'check'},{key:'lateFees',label:'Late payment fees',type:'check'},
  {key:'totalBase',label:'Total amount in base currency',type:'check'},
  {key:'customTitleOn',label:'Custom title',type:'check'},{key:'customTitle',label:'Custom title text',type:'text'},
  {key:'customThemeOn',label:'Custom theme',type:'check'},
  {key:'hideDueDate',label:'Hide — Due date',type:'check'},{key:'hideBalanceDue',label:'Hide — Balance due',type:'check'},
  {key:'showItemImages',label:'Show item images',type:'check'},{key:'showTaxCol',label:'Show tax amount column',type:'check'},
  {key:'printStatus',label:'Print paid / unpaid status tag',type:'check'},{key:'amountInWords',label:'Amount in words',type:'check'},
  {key:'alsoDelivery',label:'Also acts as delivery note',type:'check'},{key:'footers',label:'Footers',type:'check'},
  {key:'bankDetails',label:'Bank Account Details',type:'textarea'},{key:'disclaimer',label:'Disclaimer',type:'textarea'}];
const INV_FORM_SALES=[{key:'issueDate',label:'Issue date',type:'date',req:1},{key:'dueType',label:'Due date type',type:'select',options:['Net','By']},
  {key:'dueDays',label:'Due in days',type:'number'},{key:'dueDateManual',label:'Due date',type:'date'},
  {key:'reference',label:'Reference',type:'text'},{key:'customer',label:'Customer',type:'ref',from:'customers'},
  {key:'billingAddress',label:'Billing address',type:'textarea'},{key:'description',label:'Description',type:'text'}].concat(INV_OPTS_FORM);
const INV_FORM_PURCH=[{key:'issueDate',label:'Issue date',type:'date',req:1},{key:'dueType',label:'Due date type',type:'select',options:['Net','By']},
  {key:'dueDays',label:'Due in days',type:'number'},{key:'dueDateManual',label:'Due date',type:'date'},
  {key:'reference',label:'Reference',type:'text'},{key:'supplier',label:'Supplier',type:'ref',from:'suppliers'},
  {key:'billingAddress',label:'Supplier address',type:'textarea'},{key:'description',label:'Description',type:'text'}].concat(INV_OPTS_FORM);
const INV_COLS=(party,amtLabel)=>[{key:'issueDate',label:'Issue date',kind:'date'},{key:'reference',label:'Reference',kind:'text'},
  {key:party,label:party==='supplier'?'Supplier':'Customer',kind:'text'},{key:'description',label:'Description',kind:'text'},
  {key:'total',label:amtLabel||'Amount',kind:'money',r:1}];
const REG = {
  bankCash:{label:'Bank and Cash Accounts', singular:'Bank or Cash Account', newLabel:'New Bank or Cash Account',
    columns:[{key:'name',label:'Name',kind:'text'},{key:'balance',label:'Actual balance',kind:'money',r:1,color:'blue',ledger:1,calc:r=>bankActual(App.curBiz(),r)}],
    form:[{key:'name',label:'Name',type:'text',req:1},{key:'code',label:'Code',type:'text'},
      {key:'balance',label:'Starting balance',type:'money'},
      {key:'iban',label:'International Bank Account Number (IBAN)',type:'check'},
      {key:'ibanNo',label:'IBAN',type:'text',showIf:'iban'},
      {key:'pending',label:'Can have pending transactions',type:'check'},
      {key:'creditLimitOn',label:'Credit limit',type:'check'},
      {key:'creditLimit',label:'Credit limit amount',type:'money',showIf:'creditLimitOn'},
      {key:'inactive',label:'Inactive',type:'check'}],
    totalCol:'balance', extraFoot:['Import bank statement']},

  receipts:{label:'Receipts', singular:'Receipt', newLabel:'New Receipt',
    columns:[{key:'date',label:'Date',kind:'date'},{key:'reference',label:'Reference',kind:'text'},
      {key:'receivedIn',label:'Received in',kind:'text'},{key:'description',label:'Description',kind:'text'},
      {key:'paidBy',label:'Paid by',kind:'text'},{key:'amount',label:'Amount',kind:'money',r:1,bold:1}],
    form:[{key:'date',label:'Date',type:'date',req:1},{key:'reference',label:'Reference',type:'text'},
      {key:'paidByType',label:'Type',type:'text'},{key:'paidBy',label:'Received from',type:'text'},
      {key:'receivedIn',label:'Received in — Account',type:'ref',from:'bankCash'},
      {key:'description',label:'Description',type:'text'}],
    lines:{kind:'cash'}, totalCol:'amount', extraFoot:['Find & recode','Receipt - Lines']},

  payments:{label:'Payments', singular:'Payment', newLabel:'New Payment',
    columns:[{key:'date',label:'Date',kind:'date'},{key:'reference',label:'Reference',kind:'text'},
      {key:'paidFrom',label:'Paid from',kind:'text'},{key:'description',label:'Description',kind:'text'},
      {key:'payee',label:'Payee',kind:'text'},{key:'amount',label:'Amount',kind:'money',r:1,bold:1}],
    form:[{key:'date',label:'Date',type:'date',req:1},{key:'reference',label:'Reference',type:'text'},
      {key:'payeeType',label:'Type',type:'text'},{key:'payee',label:'Paid to',type:'text'},
      {key:'paidFrom',label:'Paid from — Account',type:'ref',from:'bankCash'},
      {key:'description',label:'Description',type:'text'}],
    lines:{kind:'cash'}, totalCol:'amount', extraFoot:['Find & recode','Payment - Lines']},

  iat:{label:'Inter Account Transfers', singular:'Inter Account Transfer', newLabel:'New Inter Account Transfer',
    columns:[{key:'date',label:'Date',kind:'date'},{key:'reference',label:'Reference',kind:'text'},
      {key:'paidFrom',label:'Paid from',kind:'text'},{key:'receivedIn',label:'Received in',kind:'text'},
      {key:'amount',label:'Amount',kind:'money',r:1,bold:1}],
    form:[{key:'date',label:'Date',type:'date',req:1},{key:'reference',label:'Reference',type:'text'},
      {key:'paidFrom',label:'Paid from',type:'ref',from:'bankCash'},{key:'receivedIn',label:'Received in',type:'ref',from:'bankCash'},
      {key:'amount',label:'Amount',type:'money',req:1},{key:'description',label:'Description',type:'text'}],
    totalCol:'amount'},

  bankRec:{label:'Bank Reconciliations', singular:'Bank Reconciliation', newLabel:'New Bank Reconciliation',
    columns:[{key:'date',label:'Date',kind:'date'},{key:'account',label:'Account',kind:'text'},
      {key:'statementBalance',label:'Statement balance',kind:'money',r:1},{key:'status',label:'Status',kind:'text'}],
    form:[{key:'date',label:'Date',type:'date',req:1},{key:'account',label:'Account',type:'ref',from:'bankCash'},
      {key:'statementBalance',label:'Statement balance',type:'money'},{key:'status',label:'Status',type:'select',options:['Pending','Reconciled']}]},

  customers:{label:'Customers', singular:'Customer', newLabel:'New Customer',
    columns:[{key:'name',label:'Name',kind:'text'},{key:'code',label:'Code',kind:'text'},{key:'email',label:'Email',kind:'text'},
      {key:'balance',label:'Accounts receivable',kind:'money',r:1,color:'blue',ledger:1,calc:r=>customerBalance(App.curBiz(),r.name)}],
    form:[{key:'name',label:'Customer name',type:'text',req:1},{key:'code',label:'Code',type:'text'},
      {key:'address',label:'Address',type:'textarea'},
      {key:'phone',label:'Phone number',type:'text'},{key:'email',label:'Email',type:'text'},
      {key:'trn',label:'TRN number',type:'text'},
      {key:'balance',label:'Starting balance',type:'money'}],
    totalCol:'balance'},

  salesQuotes:{label:'Sales Quotes', singular:'Sales Quote', newLabel:'New Sales Quote',
    columns:INV_COLS('customer','Total'),
    form:INV_FORM_SALES, lines:{kind:'invoice'}, totalCol:'total', extraFoot:['Sales Quotes - Lines']},

  salesOrders:{label:'Sales Orders', singular:'Sales Order', newLabel:'New Sales Order',
    columns:INV_COLS('customer','Total'),
    form:INV_FORM_SALES, lines:{kind:'invoice'}, totalCol:'total', extraFoot:['Sales Orders - Lines']},

  salesInv:{label:'Sales Invoices', singular:'Sales Invoice', newLabel:'New Sales Invoice',
    columns:[{key:'issueDate',label:'Issue date',kind:'date'},
      {key:'reference',label:'Reference',kind:'text'},{key:'customer',label:'Customer',kind:'text'},
      {key:'description',label:'Description',kind:'text'},
      {key:'total',label:'Invoice Amount',kind:'money',r:1},
      {key:'costOfSales',label:'Cost of sales',kind:'money',r:1,calc:r=>App.invCostOfSales(r)},
      {key:'balanceDue',label:'Balance due',kind:'money',r:1,color:'blue'},
      {key:'status',label:'Status',kind:'status',calc:r=>App.invStatus(r)}],
    form:INV_FORM_SALES,
    lines:{kind:'invoice'}, totalCol:'balanceDue', extraFoot:['Sales Invoices - Lines']},

  creditNotes:{label:'Credit Notes', singular:'Credit Note', newLabel:'New Credit Note',
    columns:INV_COLS('customer','Credit total'),
    form:INV_FORM_SALES, lines:{kind:'invoice'}, totalCol:'total', extraFoot:['Credit Notes - Lines']},
  deliveryNotes:{label:'Delivery Notes', singular:'Delivery Note', newLabel:'New Delivery Note',
    columns:[{key:'issueDate',label:'Issue date',kind:'date'},{key:'reference',label:'Reference',kind:'text'},{key:'customer',label:'Customer',kind:'text'},{key:'description',label:'Description',kind:'text'}],
    form:INV_FORM_SALES, lines:{kind:'invoice'}, totalCol:'total'},

  suppliers:{label:'Suppliers', singular:'Supplier', newLabel:'New Supplier',
    columns:[{key:'name',label:'Name',kind:'text'},{key:'code',label:'Code',kind:'text'},{key:'email',label:'Email',kind:'text'},
      {key:'balance',label:'Accounts payable',kind:'money',r:1,color:'blue',ledger:1,calc:r=>supplierBalance(App.curBiz(),r.name)}],
    form:[{key:'name',label:'Supplier name',type:'text',req:1},{key:'code',label:'Code',type:'text'},
      {key:'address',label:'Address',type:'textarea'},
      {key:'phone',label:'Phone number',type:'text'},{key:'email',label:'Email',type:'text'},
      {key:'trn',label:'TRN number',type:'text'},
      {key:'balance',label:'Starting balance',type:'money'}],
    totalCol:'balance'},

  purchQuotes:{label:'Purchase Quotes', singular:'Purchase Quote', newLabel:'New Purchase Quote',
    columns:INV_COLS('supplier','Total'),
    form:INV_FORM_PURCH, lines:{kind:'invoice'}, totalCol:'total', extraFoot:['Purchase Quotes - Lines']},

  purchOrders:{label:'Purchase Orders', singular:'Purchase Order', newLabel:'New Purchase Order',
    columns:INV_COLS('supplier','Total'),
    form:INV_FORM_PURCH, lines:{kind:'invoice'}, totalCol:'total', extraFoot:['Purchase Orders - Lines']},

  purchInv:{label:'Purchase Invoices', singular:'Purchase Invoice', newLabel:'New Purchase Invoice',
    columns:[{key:'issueDate',label:'Issue date',kind:'date'},
      {key:'reference',label:'Reference',kind:'text'},{key:'supplier',label:'Supplier',kind:'text'},
      {key:'description',label:'Description',kind:'text'},
      {key:'total',label:'Invoice Amount',kind:'money',r:1},
      {key:'balanceDue',label:'Balance due',kind:'money',r:1,color:'blue'},
      {key:'status',label:'Status',kind:'status',calc:r=>App.invStatus(r)}],
    form:INV_FORM_PURCH,
    lines:{kind:'invoice'}, totalCol:'balanceDue', extraFoot:['Purchase Invoices - Lines']},

  debitNotes:{label:'Debit Notes', singular:'Debit Note', newLabel:'New Debit Note',
    columns:INV_COLS('supplier','Debit total'),
    form:INV_FORM_PURCH, lines:{kind:'invoice'}, totalCol:'total', extraFoot:['Debit Notes - Lines']},

  goodsRec:{label:'Goods Receipts', singular:'Goods Receipt', newLabel:'New Goods Receipt',
    columns:INV_COLS('supplier','Total'),
    form:INV_FORM_PURCH, lines:{kind:'invoice'}, totalCol:'total', extraFoot:['Goods Receipts - Lines']},

  inventory:{label:'Inventory Items', singular:'Inventory Item', newLabel:'New Inventory Item',
    columns:[{key:'name',label:'Item name',kind:'text'},
      {key:'valuation',label:'Valuation method',kind:'text',calc:r=>'Weighted average cost'},
      {key:'qtyHand',label:'Qty on hand',kind:'text',r:1,ledger:1,calc:r=>App.numStr(invItemStats(App.curBiz(),r).qtyOnHand)},
      {key:'avgCost',label:'Average cost',kind:'money',r:1,calc:r=>invItemStats(App.curBiz(),r).avgCost},
      {key:'totalCost',label:'Total cost',kind:'money',r:1,color:'blue',ledger:1,calc:r=>invItemStats(App.curBiz(),r).totalCost}],
    form:[{key:'code',label:'Item code',type:'text'},{key:'name',label:'Name',type:'text',req:1},
      {key:'unit',label:'Unit name',type:'text'},{key:'qty',label:'Starting quantity',type:'number'},
      {key:'openingCost',label:'Starting cost (total available)',type:'money'},{key:'purchasePrice',label:'Purchase price',type:'money'},{key:'salesPrice',label:'Sales price',type:'money'}],
    totalCol:'totalCost'},

  employees:{label:'Employees', singular:'Employee', newLabel:'New Employee',
    columns:[{key:'name',label:'Name',kind:'text'},{key:'code',label:'Code',kind:'text'},{key:'email',label:'Email',kind:'text'},
      {key:'balance',label:'Net owing',kind:'money',r:1,color:'blue',ledger:1,calc:r=>employeeBalance(App.curBiz(),r.name)}],
    form:[{key:'name',label:'Name',type:'text',req:1},{key:'code',label:'Code',type:'text'},
      {key:'email',label:'Email',type:'text'},{key:'phone',label:'Phone',type:'text'}]},

  payslips:{label:'Payslips', singular:'Payslip', newLabel:'New Payslip',
    columns:[{key:'date',label:'Date',kind:'date'},{key:'reference',label:'Reference',kind:'text'},
      {key:'employee',label:'Employee',kind:'text'},{key:'description',label:'Description',kind:'text'},
      {key:'netPay',label:'Net pay',kind:'money',r:1,bold:1,color:'blue'}],
    form:[{key:'date',label:'Date',type:'date',req:1},{key:'reference',label:'Reference',type:'text'},
      {key:'employee',label:'Employee',type:'ref',from:'employees'},{key:'description',label:'Description',type:'text'}],
    lines:{kind:'payslip'}, totalCol:'netPay', extraFoot:['Payslips - Lines']},

  fixedAssets:{label:'Fixed Assets', singular:'Fixed Asset', newLabel:'New Fixed Asset',
    columns:[{key:'name',label:'Name',kind:'text'},{key:'acqDate',label:'Acquisition date',kind:'date'},
      {key:'cost',label:'Acquisition cost',kind:'money',r:1,calc:r=>faCost(App.curBiz(),r)},
      {key:'accumDep',label:'Accumulated depreciation',kind:'money',r:1,calc:r=>faAccumDep(App.curBiz(),r)},
      {key:'book',label:'Book value',kind:'money',r:1,color:'blue',ledger:1,calc:r=>faBookValue(App.curBiz(),r)}],
    form:[{key:'name',label:'Name',type:'text',req:1},{key:'acqDate',label:'Acquisition date',type:'date'},
      {key:'cost',label:'Acquisition cost',type:'money'},{key:'accumDep',label:'Accumulated depreciation (opening)',type:'money'}],
    totalCol:'book'},

  depreciation:{label:'Depreciation Entries', singular:'Depreciation Entry', newLabel:'New Depreciation Entry',
    columns:[{key:'date',label:'Date',kind:'date'},{key:'reference',label:'Reference',kind:'text'},
      {key:'description',label:'Description',kind:'text'},{key:'amount',label:'Total',kind:'money',r:1}],
    form:[{key:'date',label:'Date',type:'date',req:1},{key:'reference',label:'Reference',type:'text'},
      {key:'method',label:'Depreciation method',type:'select',options:['Reducing balance','Straight-line'],onChange:'App.deprMethodChange(this.value)'},
      {key:'description',label:'Description',type:'text'}],
    lines:{kind:'depr'}, totalCol:'amount', extraFoot:['Depreciation Entries - Lines']},

  capital:{label:'Capital Accounts', singular:'Capital Account', newLabel:'New Capital Account',
    columns:[{key:'name',label:'Name',kind:'text'},{key:'balance',label:'Balance',kind:'money',r:1,color:'blue',ledger:1,calc:r=>capitalBalance(App.curBiz(),r.name)}],
    form:[{key:'name',label:'Name',type:'text',req:1},{key:'balance',label:'Starting balance',type:'money'}],
    totalCol:'balance'},

  special:{label:'Special Accounts', singular:'Special Account', newLabel:'New Special Account',
    columns:[{key:'name',label:'Name',kind:'text'},{key:'balance',label:'Balance',kind:'money',r:1,color:'blue'}],
    form:[{key:'name',label:'Name',type:'text',req:1},{key:'balance',label:'Starting balance',type:'money'}],
    totalCol:'balance'},

  journal:{label:'Journal Entries', singular:'Journal Entry', newLabel:'New Journal Entry',
    columns:[{key:'date',label:'Date',kind:'date'},{key:'reference',label:'Reference',kind:'text'},
      {key:'narration',label:'Narration',kind:'text'},{key:'debit',label:'Debit',kind:'money',r:1},{key:'credit',label:'Credit',kind:'money',r:1}],
    form:[{key:'date',label:'Date',type:'date',req:1},{key:'reference',label:'Reference',type:'text'},
      {key:'narration',label:'Narration',type:'textarea'}],
    lines:{kind:'journal'}},
};

