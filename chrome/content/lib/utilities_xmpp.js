/*
 * Copyright 2006-2007 by Massimiliano Mirra
 * 
 * This file is part of SamePlace.
 * 
 * SamePlace is free software; you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the
 * Free Software Foundation; either version 3 of the License, or (at your
 * option) any later version.
 * 
 * SamePlace is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU
 * General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 * 
 * The interactive user interfaces in modified source and object code
 * versions of this program must display Appropriate Legal Notices, as
 * required under Section 5 of the GNU General Public License version 3.
 *
 * In accordance with Section 7(b) of the GNU General Public License
 * version 3, modified versions must display the "Powered by SamePlace"
 * logo to users in a legible manner and the GPLv3 text must be made
 * available to them.
 * 
 * Author: Massimiliano Mirra, <bard [at] hyperstruct [dot] net>
 *  
 */


function displayNameFor(presence) {
   var memo = arguments.callee.memo || (arguments.callee.memo = {});
   var stanzaString = presence.stanza.toXMLString();

   if(!memo[stanzaString]) 
       memo[stanzaString] =
           (presence.stanza.ns_muc::x == undefined ?
            XMPP.nickFor(presence.account, XMPP.JID(presence.stanza.@from).address) :
            XMPP.JID(presence.stanza.@to).address);
    
    return memo[stanzaString];
}

function contactCompletionsFor(substring) {
    function presenceDegree(stanza) {
        if(stanza.@type == undefined && stanza.show == undefined)
            return 4;
        else if(stanza.@type == 'unavailable')
            return 0;
        else
            switch(stanza.show.toString()) {
            case 'chat': return 5; break;
            case 'dnd':  return 3; break;
            case 'away': return 2; break;
            case 'xa':   return 1; break;
            default:
                throw new Error('Unexpected. (' + stanza.toXMLString() + ')');
            }
    }

    var completions = [];

    // Look for completions in roster

    XMPP.cache.fetch({
        event     : 'iq',
        direction : 'in',
        stanza    : function(s) { return s.ns_roster::query != undefined; }})
        .forEach(
            function(iq) {
                for each(var item in iq.stanza..ns_roster::item) {
                    var account = iq.session.name;
                    var address = item.@jid;
                    var nick    = XMPP.nickFor(account, address);
                    if(nick.toLowerCase().indexOf(substring.toLowerCase()) == 0)
                        completions.push(XMPP.presenceSummary(account, address));
                }                     
            });

    // Look for completions in outgoing MUC presences (i.e. active rooms)

    XMPP.cache.fetch({
        event     : 'presence',
        direction : 'out',
        stanza    : function(s) { return s.ns_muc::x != undefined; }
        }).forEach(
            function(presence) {
                var account = presence.session.name;
                var address = XMPP.JID(presence.stanza.@to).address;
                if(address.toLowerCase().indexOf(substring.toLowerCase()) == 0)
                    completions.push(presence);
            });
        
    completions.sort(
        function(a, b) {
            // Primary sort by presence, secondary by name

            var diff = presenceDegree(b.stanza) - presenceDegree(a.stanza);
            if(diff == 0)
                diff = (displayNameFor(a).toLowerCase() < displayNameFor(b).toLowerCase()) ? -1 : 1;
            return diff;
        });

    return completions;
}

function isMUCJoined(account, address) {
    var presence = XMPP.cache.fetch({
        account   : account,
        event     :'presence',
        direction : 'out',
        stanza    : function(s) {
                return s.@to != undefined &&
                    XMPP.JID(s.@to).address == address;
            }})[0];

    if(presence)
        if(presence.stanza.@type == undefined)
            return true;
        else if(presence.stanza.@type == 'unavailable')
            return false;
        else
            throw new Error('Unexpected. (' + presence.stanza.toXMLString() + ')');
    else
        return false;
}


// (MUC) BOOKMARK UTILITIES
// ----------------------------------------------------------------------

/**
 * Retrieves from cache bookmarks belonging to _account_.
 *
 */

function getMUCBookmarks(account) {
    var iq = XMPP.cache.fetch({
        event     : 'iq',
        direction : 'in',
        account   : account,
        stanza    : function(s) {
                return s.ns_private::query.ns_bookmarks::storage != undefined;
            }})[0];

    if(iq)
        return iq.stanza.ns_private::query.copy();
}

/**
 * Checks cache to see if MUC identified by _account_, _address_ is
 * bookmarked.
 *
 */

function isMUCBookmarked(account, address) {
    var query = getMUCBookmarks(account);
    var bookmark = query.ns_bookmarks::storage.ns_bookmarks::conference.(@jid == address);
    return bookmark != undefined;
}

/**
 * Retrieves from cache the bookmark for MUC identified by _account_
 * and _address_ (if any).
 *
 *
 */

function getMUCBookmark(account, address) {
    var query = getMUCBookmarks(account);
    if(query)
        return query.ns_bookmarks::storage.ns_bookmarks::conference.(@jid == address);
}

/**
 * Removes a MUC bookmark from a <query xmlns="jabber:iq:private"/>
 * element.  Doesn't modiy original query, return new one.
 *
 */

function delMUCBookmark(address, query) {
    query = query.copy();
    var bookmark = query.ns_bookmarks::storage.ns_bookmarks::conference.(@jid == address);
    if(bookmark != undefined)
        delete query.ns_bookmarks::storage.ns_bookmarks::conference[bookmark.childIndex()];
    return query;
}

/**
 * Puts a MUC bookmark into a <query xmlns="jabber:iq:private"/>
 * element, possibly replacing one with some address.  Doesn't modiy
 * original query, return new one.
 *
 */

function putMUCBookmark(bookmark, query) {
    query = delMUCBookmark(bookmark.@jid, query);
    query.ns_bookmarks::storage.appendChild(bookmark);
    return query;
}

function getJoinPresence(account, address) {
    return XMPP.cache.find({
        event     : 'presence',
        direction : 'out',
        account   : account,
        stanza    : function(s) {
            return (s.@to != undefined &&
                    s.ns_muc::x.length() > 0 &&
                    XMPP.JID(s.@to).address == address);
        }});
}
