// ==UserScript==
// @name         UnderCards script
// @description  Minor changes to undercards game
// @require      https://raw.githubusercontent.com/feildmaster/UnderScript/master/utilities.js?v=4
// @version      0.8
// @author       feildmaster
// @history      0.8 - Better performance and reliability. Disable the join queue buttons until they are ready
// @history      0.7 - updated to new restrictions, thanks cloudflare -_-
// @history      0.6 - some upgrades to the battle log, fixed url
// @history    0.5.4 - Don't scroll the battle log with the page (possibly make this configurable later)
// @history    0.5.3 - Remove the chat stuff, the new chat is better.
// @history    0.5.2 - do the same for the chat window
// @history    0.5.1 - don't cover the battle screen
// @history      0.5 - remember chat messages on page-change, added a battle log, lots of code changes
// @history      0.4 - Remember "event deck" too!, also fixed bugs.
// @history      0.3 - Lowered "game found" volume
// @history      0.2 - Added EndTurn hotkey (space, middle click), focus chat (enter)
// @history      0.1 - Made deck selection smart
// @match        https://undercards.net/*
// @website      https://github.com/feildmaster/UnderScript
// @supportURL   https://github.com/feildmaster/UnderScript/issues
// @downloadURL  https://raw.githubusercontent.com/feildmaster/UnderScript/master/undercards.js
// @namespace    http://tampermonkey.net/
// @grant        none
// ==/UserScript==
// TODO: more Hotkeys
// TODO: Visual attack targets
// TODO: Random deck option
// TODO: Detailed history log

// === Variables start
var hotkeys = [
    new Hotkey("Focus Chat").bindKey(13).run(function(e) { // Join/Show chat and position cursor to input box
        if (hide) {
            // This currently already works
        }
        $('#message').focus(); // Always do this
    }),
];
// === Variables end

eventManager.on("getWaitingQueue", function lowerVolume() {
    // Lower the volume, the music changing is enough as is
    audioQueue.volume = 0.3;
});

eventManager.on("PlayingGame", function bindHotkeys() {
    // Binds to Space, Middle Click
    hotkeys.push(new Hotkey("End turn").bindKey(32).bindClick(2).run((e) => {if (!$(e.target).is("#endTurnBtn") && userTurn && userTurn === userId) endTurn();}));
});

eventManager.on("GameStart", function battleLogger() {
    var turn = 0, currentTurn = 0, players = {}, monsters = {}, lastEffect, other = {}, finished = false;
    var make = {
        player: function makePlayer(player) {
            var c = $("<span>");
            c.append(player.username);
            // show lives, show health, show gold, show hand, possibly deck size as well
            //c.attr("title", `${player.gold} gold`); // gold is broken
            //c.hover(); // TODO: hover information
            c.addClass(player.class);
            return c[0].outerHTML;
        },
        card: function makeCard(card) {
            var c = $("<span>");
            c.append(card.name);
            //c.hover(); // TODO: hover information
            return c[0].outerHTML;
        },
    };

    // TODO: Clean this up
    // This is an ugly thing!
    eventManager.on("GameEvent", function logEvent(data) {
        if (finished) return; // Sometimes we get events after the battle is over
        // TODO: Delayed events... (green soul, discard (for example, sans))
        var card, you, enemy;
        // Battle logging happens after the game runs
        switch(data.action) {
            case "getAllGameInfos": // Initialize "spectate" history here
                // board = [0, 1, 2, 3, 4, 5, 6, 7, 8]
                // ---- typeCard: 0 = enemy; 1: spell
                // -- card: {attack, hp, maxHp, originalAttack, originalHp, paralyzed, silence, poisoned, taunt, id, typeCard, name, image, cost, description, rarity, shiny, quantity}
                // TODO: turnTime monitoring
                you = JSON.parse(data.you);
                enemy = JSON.parse(data.ennemy);
                you.class = data.yourClass;
                enemy.class = data.enemyClass;
                // Set gold
                var gold = JSON.parse(data.golds);
                you.gold = gold[you.id];
                enemy.gold = gold[enemy.id];
                // Set lives
                var lives = JSON.parse(data.lives);
                you.lives = lives[you.id];
                enemy.lives = lives[enemy.id];
                // populate monsters
                JSON.parse(data.board).forEach(function (card) {
                    if (card === null) return;
                    monsters[card.id] = card;
                });
            case "getGameStarted": // Initialize "game" history here
                turn = data.turn || 0;
                if (!you) {
                    you = {id: data.yourId, username: data.yourUsername, hp: 30, class: data.yourClass, level: data.yourLevel, rank: data.yourRank, gold: 2};
                    enemy = {id: data.ennemyId, username: data.ennemyUsername, hp: 30, class: data.enemyClass, level: data.enemyLevel, rank: data.enemyRank, gold: 2};
                }
                players[you.id] = you;
                players[enemy.id] = enemy;
                // Test changing ID's at endTurn instead of startTurn
                other[you.id] = enemy.id;
                other[enemy.id] = you.id;
                // Initialize the log
                log.init();
                $("div#history div.handle").html(`[${data.gameType}] ${make.player(you)} vs ${make.player(enemy)}`);
                log.add(`Turn ${turn}`);
                if (data.userTurn) {
                    currentTurn = data.userTurn;
                    log.add(`${make.player(players[data.userTurn])}'s turn`);
                }
                return;
            case "getFight": // monster attack monster
                log.add(`${make.card(monsters[data.attackMonster])} attacked ${make.card(monsters[data.defendMonster])}`);
                return;
            case "getFightPlayer": // monster attacking player
                log.add(`${make.card(monsters[data.attackMonster])} attacked ${make.player(players[data.defendPlayer])}`);
                return;
            case "getUpdatePlayerHp":
                var oHp = players[data.playerId].hp;
                var hp = data.isDamage ? oHp - data.hp : data.hp - oHp;
                players[data.playerId].hp = data.hp;
                if (oHp !== data.hp) { // If the player isn't at 0 hp already
                    log.add(`${make.player(players[data.playerId])} ${data.isDamage ? "lost" : "gained"} ${hp} hp`);
                }
                if (data.hp === 0 && players[data.playerId].lives > 0 && !players[data.playerId].hasOwnProperty("lostLife")) { // If they have extra lives, and they didn't lose a life already
                    log.add(`${make.player(players[data.playerId])} lost a life`);
                    players[data.playerId].lostLife = true;
                }
                return;
            case "getDoingEffect": // Card doing effect
                // affecteds: [ids]; monsters affected
                // playerAffected1: id; player affected
                // playerAffected2: id; player affected
                // TODO: Figure out how to do this better
                if (lastEffect === data.monsterId) return;
                lastEffect = data.monsterId;
                log.add(`${make.card(monsters[data.monsterId])}'s effect activated.`);
                return;
            case "getSoulDoingEffect": // Soul doing effect
                log.add(`${make.player(players[data.playerId])}'s soul activated.`);
                // affecteds
                // playerAffected1
                // playerAffected2
                return;
            case "updateMonster":
                // monster {card}
                return;
            case "getTurnStart": // Turn started
                lastEffect = 0;
                if (data.numTurn !== turn) {
                    log.add(`Turn ${data.numTurn}`);
                }
                currentTurn = data.idPlayer; // It would (kindof) help to actually update who's turn it is
                turn = data.numTurn;
                log.add(`${make.player(players[currentTurn])}'s turn`);
                return;
            case "getTurnEnd": // Turn ended
                // Lets switch the turn NOW, rather than later, the purpose of this is currently unknown... It just sounded like a good idea, also delete the "lostLife" flag...
                delete players[currentTurn].lostLife;
                currentTurn = other[data.idPlayer];
                delete players[currentTurn].lostLife;
                lastEffect = 0;
                return;
            case "getUpdateBoard":
                var oldMonsters = monsters;
                monsters = {};
                // TOOD: stuff....
                JSON.parse(data.board).forEach(function (card) {
                    if (card === null) return;
                    monsters[card.id] = card;
                });
                return;
            case "getMonsterDestroyed": // Monster killed
                // monsterId: #
                log.add(`${make.card(monsters[data.monsterId])} was killed`);
                delete monsters[data.monsterId];
                return;
                //case "refreshTimer": // Probably don't need this
            case "getPlayableCards": // Probably don't need this
                // playableCards [#...]
                return;
            case "getCardBoard": // Adds card to X, Y (0(enemy), 1(you))
                // card
                // idPlayer
                card = JSON.parse(data.card);
                monsters[card.id] = card;
                log.add(`${make.player(players[data.idPlayer])} played ${make.card(card)}`);
                return;
            case "getSpellPlayed": // Spell used
                // idPlayer
                // card
                // immediately calls "getDoingEffect" and "getUpdateBoard"
                card = JSON.parse(data.card);
                monsters[card.id] = card;
                log.add(`${make.player(players[data.idPlayer])} used ${make.card(card)}`);
                return;
            case "updateSpell": // Use spell
                return;
            case "getFakeDeath": // Card fake exploded... will be re-added 1 second later?
                return;
            case "getCardDestroyedHandFull": // Card destroyed from full hand
                card = JSON.parse(data.card);
                // This event gets called for *all* discards. Have to do smarter logic here (not just currentTurn!)
                log.add(`${make.player(players[currentTurn])} discarded ${make.card(card)}`);
                return;
            case "getPlayerStats": // TODO: When does this get called?
                var key, temp = JSON.parse(data.handsSize);
                for (key in temp) {
                    // TODO: hand size monitoring
                    //players[key].hand
                }
                // TODO: deck monitoring (decksSize)
                temp = JSON.parse(data.golds);
                for (key in temp) {
                    players[key].gold = temp[key];
                }
                temp = JSON.parse(data.lives);
                for (key in temp) {
                    players[key].lives = temp[key];
                }
                return;
            case "getVictory": // TODO
            case "getVictoryDeco": // TODO
            case "getDefeat": // TODO
                break;
            case "getResult": // Fight Finish
                finished = true;
                if (data.cause === "Surrender") {
                    log.add(`${data.looser} surrendered.`);
                }
                if (data.cause === "Chara") {
                    //log.add(`${data.winner} played Chara`);
                }
                if (data.cause === "Disconnection") {
                    log.add(`${data.looser} disconnected.`);
                }
                log.add(`${data.winner} beat ${data.looser}`);
                return;
        }
    });
});

// === Play hooks
onPage("Play", function() {
    debug("On play page");
    function applyDeck(type, last) {
        var deck = $(`#${type}`);
        if (!deck.length) return;
        if (localStorage[last] && $(`#${type} option`).filter((i,o) => o.value === localStorage[last]).length !== 0) {
            deck.val(localStorage[last]).change();
        }
        deck.change(function update() {
            localStorage[last] = $(`#${type} option:selected`).val();
        });
    }

    applyDeck("classicDecks", "lastClassic"); // Classic class storage
    applyDeck("rankedDecks", "lastRanked"); // Ranked class storage
    applyDeck("eventDecks", "lastEvent"); // Event class storage
    var queues = $("button.btn.btn-primary");
    queues.prop("disabled", true);

    (function hook() {
        if (typeof socketQueue === "undefined") {
            debug("Timeout hook");
            return setTimeout(hook);
        }
        // TODO: Better "game found" support
        var oOpen = socketQueue.onopen;
        socketQueue.onopen = function onOpenScript(event) {
            if (oOpen) oOpen(event);
            queues.prop("disabled", false);
        };
        var oHandler = socketQueue.onmessage;
        socketQueue.onmessage = function onMessageScript(event) {
            var data = JSON.parse(bin2str(event.data));
            oHandler(event);
            eventManager.emit(data.action, data);
        };
    })();
});

// === Game hooks
onPage("Game", function() {
    debug("Playing Game");
    (function hook() {
        if (typeof socket === "undefined") {
            debug("Timeout hook");
            return setTimeout(hook);
        }
        var oHandler = socket.onmessage;
        socket.onmessage = function onMessageScript(event) {
            var data = JSON.parse(bin2str(event.data));
            //console.log(bin2str(event.data));
            oHandler(event);
            if (data.action === "getGameStarted") {
                // We're running our game.
                eventManager.emit("GameStart");
                eventManager.emit("PlayingGame");
            }
            eventManager.emit("GameEvent", data);
        };
    })();
});

// Spectate hooks
onPage("gameSpectate", function() {
    debug("Spectating Game");
    eventManager.emit("GameStart");
    (function hook() {
        if (typeof socket === "undefined") {
            debug("Timeout hook");
            return setTimeout(hook);
        }
        var oHandler = socket.onmessage;
        socket.onmessage = function onMessageScript(event) {
            //console.log(bin2str(event.data));
            oHandler(event);
            eventManager._emitRaw("GameEvent", event.data);
        };
    })();
});

// === Always do the following - if jquery is loaded
var tries = 3;
(function jSetup() {
    if (typeof jQuery === "undefined") {
        if (tries-- > 0) { // jQuery is probably not going to load at this point...
            setTimeout(jSetup);
        }
        return;
    }
    // Bind hotkey listeners
    $(document).on("click.script", function (event) {
        if (false) return; // TODO: Check for clicking in chat
        hotkeys.forEach(function(v) {
            if (v.clickbound(event.which)) {
                v.run(event);
            }
        });
    });
    $(document).on("keyup.script", function (event) {
        if ($(event.target).is("input")) return; // We don't want to listen while typing in chat (maybe listen for F-keys?)
        hotkeys.forEach(function(v) {
            if (v.keybound(event.which)) {
                v.run(event);
            }
        });
    });
    $(window).unload(function() {
        // Store chat text (if any)
        var val = $("div.chat-public input.chat-text").val();
        if (!val) return;
        localStorage.oldChat = val;
    });
    if (localStorage.oldChat) {
        $("div.chat-public input.chat-text").val(localStorage.oldChat);
        delete localStorage.oldChat;
    }
})();
