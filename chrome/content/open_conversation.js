/*
  Copyright (C) 2005-2006 by Massimiliano Mirra

  This program is free software; you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation; either version 2 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program; if not, write to the Free Software
  Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301 USA

  Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
*/


// GLOBAL DEFINITIONS
// ----------------------------------------------------------------------

const Cc = Components.classes;
const Ci = Components.interfaces;

var xmpp = xmpp || {};
xmpp.ui = xmpp.ui || {};


// GLOBAL STATE
// ----------------------------------------------------------------------

var request;


// INITIALIZATION
// ----------------------------------------------------------------------

function init() {
    var arg = window.arguments[0];
    if(arg instanceof Ci.nsIProperties) {
        request = {};
        for each(var property in ['account', 'address', 'nick', 'type']) 
            request[property] = (arg.has(property) ?
                                 arg.get(property, Ci.nsISupportsString).toString() : '');
    } else
        request = arg;

    for each(var fieldName in ['account', 'address', 'nick', 'type'])
        if(request[fieldName])
            _(fieldName).value = request[fieldName];

    if(request.address)
        _('nick').focus();
    else
        _('address').select();

    xmpp.ui.refreshAccounts(_('xmpp-popup-accounts'));

    _('account').value = (request.account ||
                          (XMPP.accounts.filter(XMPP.isUp)[0] || XMPP.accounts[0]).jid);

    refresh();
}


// GUI ACTIONS
// ----------------------------------------------------------------------

function doOk() {
    function v(id) { return _(id).value; }
    
    switch(v('type')) {
    case 'chat':
        XMPP.send(v('account'),
                  <message to={v('address')}>
                  <active xmlns={ns_chatstates}/>
                  </message>);
        break;
    case 'groupchat':
        XMPP.send(v('account'),
                  <presence to={v('address') + '/' + v('nick')}>
                  <x xmlns='http://jabber.org/protocol/muc'/>
                  </presence>);
        break;
    }
    return true;
}

function doCancel() {
    return true;
}

function refresh() {
    _('nick').parentNode.hidden = (_('type').value != 'groupchat');

    if(_('account').value && _('address').value)
        if(_('type').value == 'groupchat' && _('nick').value)
            _('main').getButton('accept').disabled = false;
        else if(_('type').value == 'chat')
            _('main').getButton('accept').disabled = false;
        else
            _('main').getButton('accept').disabled = true;
    else
        _('main').getButton('accept').disabled = true;
}


// UTILITIES
// ----------------------------------------------------------------------

function _(id) {
    return document.getElementById(id);
}
