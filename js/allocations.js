/* ===================== Payment / invoice allocation panel (additive) =========
   On a Receipt or Payment, once a line posts to Accounts receivable / Accounts
   payable with a party chosen, this panel appears under the line items and lets
   the user apply the money to that party's open invoices without leaving the
   form. What it produces is `rec.allocations` - the payment_allocations join
   rows - which settlementIndex() in accounting.js turns into invoice balances.

   It adds no posting of its own: the double entry is still the AR/AP line.
   ============================================================================ */
(function(global){
  'use strict';

  var AR = /^accounts receivable$/i, AP = /^accounts payable$/i;
  var SIDE_LABEL = { cust:{ party:'customer', doc:'invoice', head:'Outstanding invoices' },
                     sup: { party:'supplier', doc:'bill',    head:'Outstanding bills' } };

  function app(){ try{ return App; }catch(e){ return global.App || null; } }
  function esc(s){ var A=app(); return A ? A.esc(s==null?'':s) : String(s==null?'':s); }
  function num(v){ var n=parseFloat(String(v==null?'':v).replace(/,/g,'')); return isNaN(n)?0:n; }
  function r2(n){ return Math.round((Number(n)||0)*100)/100; }
  function money(n){ var A=app(); try{ return A.money(n); }catch(e){ return r2(n).toFixed(2); } }
  function d(s){ return String(s||'').slice(0,10); }
  function cssEsc(v){ return String(v==null?'':v).replace(/["\\]/g,'\\$&'); }
  function uidOf(rec){ try{ return invUid(rec); }catch(e){ return (rec && (rec.uuid || 'id:'+rec.id)) || ''; } }

  var state = { host:null, key:null, entered:{} };   // entered: uid -> raw string

  /* ------------------------------------------------------------ form reading */

  function rowAmount(row){
    var el = row.querySelector('[data-var="totalWithTax"]');
    if(el && String(el.value||'').trim() !== '') return el.value;
    el = row.querySelector('[data-var="amountNoTax"]');
    if(el && String(el.value||'').trim() !== '') return el.value;
    el = row.querySelector('[data-var="amount"]');
    return el ? el.value : 0;
  }

  /** The AR / AP money on the form right now, grouped by party. */
  function scanParties(host, key){
    var tbl = host && host.querySelector('[data-line-items]');
    if(!tbl || !tbl.tBodies[0]) return [];
    var byParty = {}, order = [];
    var rows = tbl.tBodies[0].rows;
    for(var i=0;i<rows.length;i++){
      var row = rows[i];
      var accEl = row.querySelector('[data-account-col]') || row.querySelector('select[data-qc-source="account"]');
      var subEl = row.querySelector('[data-subaccount-col]');
      if(!accEl || !subEl) continue;
      var acct = String(accEl.value||'').trim();
      var isAR = AR.test(acct), isAP = AP.test(acct);
      if(!isAR && !isAP) continue;
      var party = String(subEl.value||'').trim();
      if(!party) continue;
      /* A receipt against Accounts receivable, or a payment against Accounts
         payable, settles what the party owes. The other way round is a refund,
         which re-opens a balance rather than closing an invoice. */
      var side = isAR ? 'cust' : 'sup';
      var settles = (key === 'receipts' && isAR) || (key === 'payments' && isAP);
      var k = side + ' ' + party;
      if(!byParty[k]){ byParty[k] = { side:side, party:party, settles:settles, amount:0 }; order.push(k); }
      byParty[k].amount += num(rowAmount(row));
    }
    return order.map(function(k){ var g=byParty[k]; g.amount=r2(g.amount); return g; });
  }

  /** The document being edited, so its own allocations do not count as paid. */
  function currentDoc(){
    var A = app(); if(!A || A.editingId == null) return null;
    try{ return (A.records(A.curBiz())||[]).filter(function(r){ return r.id === A.editingId; })[0] || null; }
    catch(e){ return null; }
  }

  /* --------------------------------------------------------------- rendering */

  function invoicesFor(side, party){
    var A = app(), b = A && A.curBiz();
    if(!b) return { open:[], all:[] };
    var doc = currentDoc();
    var ix;
    try{ ix = settlementIndex(b, side, doc ? { skipDoc: uidOf(doc) } : {}); }
    catch(e){ return { open:[], all:[] }; }
    var row = ix.byParty[party];
    if(!row) return { open:[], all:[] };
    return { open: row.invoices.filter(function(r){ return r.outstanding > 0.005; }), all: row.invoices };
  }

  function prefilled(uid){
    if(Object.prototype.hasOwnProperty.call(state.entered, uid)) return state.entered[uid];
    var doc = currentDoc();
    if(!doc) return '';
    var found = ((doc.allocations)||[]).filter(function(a){ return a && a.uid === uid; })[0];
    return found ? String(found.amount) : '';
  }

  function sectionHtml(g){
    var L = SIDE_LABEL[g.side];
    var inv = invoicesFor(g.side, g.party);
    var head = '<div class="alloc-h"><span>' + esc(L.head) + ' - ' + esc(g.party) + '</span>' +
               '<span class="alloc-amt">Payment amount <b>' + money(g.amount) + '</b></span></div>';

    if(!g.settles){
      var owed = inv.open.reduce(function(a, r){ return a + r.outstanding; }, 0);
      return '<div class="alloc-sec" data-alloc-side="' + esc(g.side) + '" data-alloc-party="' + esc(g.party) + '" data-alloc-info>' +
        head + '<div class="alloc-note">This line refunds ' + esc(g.party) + ', so it re-opens a balance rather than settling ' +
        (g.side === 'cust' ? 'an invoice' : 'a bill') + '. ' +
        (owed > 0.005
          ? esc(g.party) + ' currently owes ' + money(owed) + ' across ' + inv.open.length + ' open ' + L.doc + (inv.open.length === 1 ? '' : 's') + '.'
          : 'Nothing is outstanding for ' + esc(g.party) + '.') +
        '</div></div>';
    }

    if(!inv.open.length){
      return '<div class="alloc-sec" data-alloc-side="' + esc(g.side) + '" data-alloc-party="' + esc(g.party) + '">' +
        head + '<div class="alloc-note">No outstanding ' + esc(L.doc) + 's for this ' + esc(L.party) + '. ' +
        'The payment can still be saved - it stays as an unallocated credit you can apply later.</div></div>';
    }

    var body = inv.open.map(function(r){
      var pre = prefilled(r.uid);
      return '<tr>' +
        '<td class="alloc-pick-c"><input type="checkbox" class="alloc-pick"' +
          ' aria-label="Select ' + esc(r.invoice.reference || 'invoice') + '"' +
          ' data-alloc-uid="' + esc(r.uid) + '"' + (num(pre) > 0.005 ? ' checked' : '') + '></td>' +
        '<td>' + esc(r.invoice.reference || '(no reference)') + '</td>' +
        '<td>' + esc(d(r.invoice.issueDate || r.invoice.date)) + '</td>' +
        '<td>' + esc(d(r.invoice.dueDate)) + '</td>' +
        '<td class="r m">' + money(r.total) + '</td>' +
        '<td class="r m">' + money(r.paid) + '</td>' +
        '<td class="r m">' + money(r.outstanding) + '</td>' +
        '<td class="r"><input class="alloc-in" type="text" inputmode="decimal"' +
          ' aria-label="Apply to ' + esc(r.invoice.reference || 'invoice') + '"' +
          ' data-alloc-uid="' + esc(r.uid) + '" data-alloc-max="' + r.outstanding + '"' +
          ' data-alloc-ref="' + esc(r.invoice.reference || '') + '"' +
          ' value="' + esc(pre) + '"></td>' +
      '</tr>';
    }).join('');

    return '<div class="alloc-sec" data-alloc-side="' + esc(g.side) + '" data-alloc-party="' + esc(g.party) + '" data-alloc-amount="' + g.amount + '">' +
      head +
      '<div class="alloc-scroll"><table class="alloc-tbl"><thead><tr>' +
        '<th class="alloc-pick-c"><span class="sr-only">Select</span></th>' +
        '<th>' + (g.side === 'cust' ? 'Invoice #' : 'Bill #') + '</th><th>Date</th><th>Due date</th>' +
        '<th class="r">Original</th><th class="r">Paid</th><th class="r">Outstanding</th><th class="r">Apply</th>' +
      '</tr></thead><tbody>' + body + '</tbody></table></div>' +
      '<div class="alloc-foot">' +
        '<button type="button" class="btn btn-sm alloc-auto">Apply oldest first</button>' +
        '<button type="button" class="btn btn-sm alloc-clear">Clear</button>' +
        '<span class="alloc-sp"></span>' +
        '<span>Total allocated <b data-alloc-total>0.00</b></span>' +
        '<span>Unallocated <b data-alloc-left>0.00</b></span>' +
      '</div>' +
      '<div class="alloc-err hide" data-alloc-err></div></div>';
  }

  /** Rebuild the whole panel from the current state of the form. */
  function refresh(){
    var host = state.host; if(!host) return;
    var panel = host.querySelector('#allocPanel'); if(!panel) return;
    var groups = scanParties(host, state.key);
    panel.innerHTML = groups.length ? groups.map(sectionHtml).join('') : '';
    if(panel.classList) panel.classList.toggle('hide', !groups.length);
    recompute();
  }

  /* --------------------------------------------------------------- totalling */

  function sections(){
    var host = state.host; if(!host) return [];
    return Array.prototype.slice.call(host.querySelectorAll('.alloc-sec[data-alloc-amount]'));
  }

  /** Live totals + validation for one section. Returns its error, or ''. */
  function tally(sec){
    var amount = num(sec.getAttribute('data-alloc-amount'));
    var ins = sec.querySelectorAll('.alloc-in');
    var total = 0, err = '';
    for(var i=0;i<ins.length;i++){
      var el = ins[i], raw = String(el.value||'').trim();
      var v = raw === '' ? 0 : num(raw);
      var max = num(el.getAttribute('data-alloc-max'));
      var bad = '';
      if(raw !== '' && isNaN(parseFloat(raw.replace(/,/g,'')))) bad = 'Enter a number.';
      else if(v < 0) bad = 'A negative amount cannot be applied.';
      else if(v > max + 0.005) bad = 'Cannot apply more than the ' + r2(max).toFixed(2) +
        ' outstanding on ' + (el.getAttribute('data-alloc-ref') || 'this invoice') + '.';
      if(el.classList) el.classList.toggle('bad', !!bad);
      if(bad && !err) err = bad;
      /* the tick box and the amount are two views of one thing */
      var pick = sec.querySelector('.alloc-pick[data-alloc-uid="' + cssEsc(el.getAttribute('data-alloc-uid')) + '"]');
      if(pick) pick.checked = v > 0.005;
      total += v;
    }
    total = r2(total);
    var left = r2(amount - total);
    if(!err && total > amount + 0.005) err = 'Allocated amount cannot exceed payment amount.';
    var t = sec.querySelector('[data-alloc-total]'), l = sec.querySelector('[data-alloc-left]');
    if(t) t.textContent = money(total);
    if(l){ l.textContent = money(left); if(l.classList) l.classList.toggle('neg', left < -0.005); }
    var e = sec.querySelector('[data-alloc-err]');
    if(e){ e.textContent = err; if(e.classList) e.classList.toggle('hide', !err); }
    return err;
  }

  function recompute(){ sections().forEach(tally); }

  /** The first validation problem across the panel, or null when it is clean. */
  function validate(){
    var bad = null;
    sections().forEach(function(sec){ var e = tally(sec); if(e && !bad) bad = e; });
    return bad;
  }

  /** The payment_allocations rows for this document. */
  function collect(){
    var out = [];
    sections().forEach(function(sec){
      var side = sec.getAttribute('data-alloc-side');
      var party = sec.getAttribute('data-alloc-party');
      var invKey = side === 'sup' ? 'purchInv' : 'salesInv';
      sec.querySelectorAll('.alloc-in').forEach(function(el){
        var v = r2(num(el.value));
        if(v > 0.005) out.push({ key:invKey, uid:el.getAttribute('data-alloc-uid'), party:party, amount:v });
      });
    });
    return out;
  }

  /* ----------------------------------------------------------------- wiring */

  var pending = 0;
  function scheduleRefresh(){
    if(pending) return;
    pending = setTimeout(function(){ pending = 0; refresh(); }, 0);
  }

  function onInput(e){
    var el = e.target;
    if(!el) return;
    if(el.classList && el.classList.contains('alloc-in')){
      state.entered[el.getAttribute('data-alloc-uid')] = el.value;
      var sec = el.closest && el.closest('.alloc-sec');
      if(sec) tally(sec);
      return;
    }
    /* an account, party or amount changed - the whole panel may be different */
    if(el.closest && el.closest('[data-line-items]')) scheduleRefresh();
  }

  /** What is still free to apply in this section, ignoring one row. */
  function freeIn(sec, exceptUid){
    var left = num(sec.getAttribute('data-alloc-amount'));
    sec.querySelectorAll('.alloc-in').forEach(function(inp){
      if(inp.getAttribute('data-alloc-uid') === exceptUid) return;
      left -= num(inp.value);
    });
    return r2(left);
  }

  function setRow(inp, value){
    inp.value = value > 0.005 ? r2(value).toFixed(2) : '';
    state.entered[inp.getAttribute('data-alloc-uid')] = inp.value;
  }

  function onClick(e){
    var el = e.target;
    if(!el || !el.classList || !el.closest) return;
    var sec = el.closest('.alloc-sec');
    if(!sec) return;
    if(el.classList.contains('alloc-pick')){
      var uid = el.getAttribute('data-alloc-uid');
      var inp = sec.querySelector('.alloc-in[data-alloc-uid="' + cssEsc(uid) + '"]');
      if(inp){
        /* ticking applies as much of what is left as this invoice can take */
        setRow(inp, el.checked ? Math.min(num(inp.getAttribute('data-alloc-max')), Math.max(0, freeIn(sec, uid))) : 0);
        tally(sec);
      }
      return;
    }
    if(el.classList.contains('alloc-auto')){
      var left = num(sec.getAttribute('data-alloc-amount'));
      sec.querySelectorAll('.alloc-in').forEach(function(inp){
        var use = Math.max(0, Math.min(left, num(inp.getAttribute('data-alloc-max'))));
        left = r2(left - use);
        setRow(inp, use);
      });
      tally(sec);
    } else if(el.classList.contains('alloc-clear')){
      sec.querySelectorAll('.alloc-in').forEach(function(inp){ setRow(inp, 0); });
      tally(sec);
    }
  }

  /** Called once the designed Receipt / Payment form is in the DOM. */
  function mount(host, key){
    if(!host || (key !== 'receipts' && key !== 'payments')) return;
    state = { host:host, key:key, entered:{} };
    var form = host.querySelector('.app-form') || host;
    var tbl = host.querySelector('[data-line-items]');
    var anchor = tbl ? (tbl.closest('.li-wrap') || tbl) : null;
    var panel = global.document.createElement('div');
    panel.id = 'allocPanel';
    panel.className = 'alloc-panel hide';
    if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
    else form.appendChild(panel);
    host.addEventListener('input', onInput);
    host.addEventListener('change', onInput);
    host.addEventListener('click', onClick);
    refresh();
  }

  global.Allocations = {
    mount:mount, refresh:refresh, recompute:recompute, validate:validate, collect:collect,
    scanParties:scanParties, invoicesFor:invoicesFor, _state:function(){ return state; }
  };
})(typeof window !== 'undefined' ? window : this);
