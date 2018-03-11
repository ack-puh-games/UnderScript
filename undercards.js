// ==UserScript==
// @name         UnderCards script
// @description  Minor changes to undercards game
// @require      https://raw.githubusercontent.com/feildmaster/UnderScript/master/utilities.js?v=5
// @version      0.9.0-beta
// @author       feildmaster
// @history    0.9.0 - Added detailed history log, log is top-bottom now
// @history    0.8.5 - Added some game debug
// @history    0.8.4 - Removed "remember deck" feature (upstream), fixed event log
// @history    0.8.3 - Script works now
// @history    0.8.2 - Fix the queue disconnecting.
// @history    0.8.1 - Rework loading jQuery performance
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
// @namespace    https://feildmaster.com/
// @grant        none
// ==/UserScript==
// TODO: more Hotkeys
// TODO: Visual attack targets
// TODO: Random deck option

// === Variables start
var hotkeys = [];
// === Variables end

eventManager.on("getWaitingQueue", function lowerVolume() {
    // Lower the volume, the music changing is enough as is
    audioQueue.volume = 0.3;
});

eventManager.on("PlayingGame", function bindHotkeys() {
    // Binds to Space, Middle Click
    hotkeys.push(new Hotkey("End turn").bindKey(32).bindClick(2).run((e) => {
        if (!$(e.target).is("#endTurnBtn") && userTurn && userTurn === userId) endTurn();
    }));
});

eventManager.on("GameStart", function battleLogger() {
    let turn = 0, currentTurn = 0, players = {}, monsters = {}, lastEffect, other = {}, finished = false;
    const hover = (function wrapper() {
        let e, x, y;
        function update() {
            if (!e) return;
            e.css({
                // move to left if at the edge of screen
                left: x + e.width() + 15 < $(window).width() ? x + 15 : x - e.width() - 10,
                // Try to lock to the bottom
                top: y + e.height() + 18 > $(window).height() ? $(window).height() - e.height() : y + + 18,
            });
        }
        $(document).on("mousemove.script", function mouseMove(event) {
            x = event.pageX;
            y = event.pageY;
            update();
        });
        return function hover(data, border = "2px solid white") {
            if (e) {
                // Hide element
                e.remove();
                e = null;
                return;
            }
            if (!data) return;
            // Make the element
            e = $("<div>");
            e.append(data);
            e.css({
                border,
                position: "fixed",
                "background-color": "rgba(0,0,0,0.9)",
                padding: '2px',
                'z-index': 20,
            });
            $("body").append(e);
            update();
        };
    })();
    const make = {
        player: function makePlayer(player, title = false) {
            const c = $('<span>');
            c.append(player.username);
            c.addClass(player.class);
            if (!title) {
                c.css('text-decoration', 'underline');
                // show lives, show health, show gold, show hand, possibly deck size as well
                var data = `${player.hp} hp, ${player.gold} gold`;
                c.hover(() => hover(data));
            }
            return c;
        },
        card: function makeCard(card) {
            const c = $('<span>');
            c.append(card.name);
            c.css('text-decoration', 'underline');
            
            const status = [];
            if (card.taunt) {
                status.push('taunt');
            }
            if (card.charge) {
                status.push('charge');
            }
            if (card.attack !== card.originalAttack) {
                status.push(card.attack > card.originalAttack ? 'bonusAtk' : 'malusAtk');
            }
            if (card.maxHp > card.originalHp) {
                status.push('bonusHp');
            }
            if (card.paralyzed) {
                status.push('paralyzed');
            }
            if (card.candy) {
                status.push('candy');
            }
            if (card.kr) {
                status.push('poison');
            }
            if (card.cantAttack) {
                status.push('cantAttack');
            }
            if (card.notTargetable) {
                status.push('notTargetable');
            }
            if (card.resurrect) {
                status.push('resurrect');
            }
            if (card.invincible) {
                status.push('invulnerable');
            }
            if (card.transparency) {
                status.push('transparency');
            }
            if (card.rarity === "DETERMINATION") {
                status.push('determination');
            }
            if (card.silence) {
                status.push('silenced');
            }
            if (card.catchedMonster) {
                status.push('box');
            }
            let data = `<table class="cardBoard ${card.paralyzed ? 'paralyzed' : ''}">`;
            data += `<tr><td class="cardName resize ${card.classe || card.class}" colspan="3">${card.name}`;
            if (card.shiny) {
                // TODO: rainbow
            }
            // TODO: skins
            data += `</td><td class="cardCost">${card.cost}</td></tr>`;
            data += `<tr><td id="cardImage" colspan="4">`;
            if (status.length) {
                // add status images
                status.forEach((s, i) => {
                    data += `<img class="infoPowers" style="z-index:20;right:${4 + i * 20}px;" src="images/powers/${s}.png"/>`;
                });
            }
            data += `<img src="images/cards/${card.image}.png"/></td></tr>`;
            data += `<tr><td class="cardDesc" colspan="4">${card.desc || ''}</td></tr>`;
            if (!card.typeCard) {
                data += `<tr><td id="cardATQ">${card.attack}</td><td id="cardRarity" colspan="2"><img src="images/rarity/${card.rarity}.png" /></td><td id="cardHP" class="${card.hp!==card.maxHp ? "damaged" : ""}">${card.hp}</td></tr>`;
            } else {
                data += `<tr><td id="cardRarity" colspan="4"><img src="images/rarity/${card.rarity}.png" /></td></tr>`;
            }
            data += `</table>`;
            c.hover(() => hover(data, null));
            return c;
        },
    };

    // TODO: Clean this up
    // This is an ugly thing!
    eventManager.on("GameEvent", function logEvent(data) {
        if (finished) { // Sometimes we get events after the battle is over
            if (localStorage.getItem("debuggingExtra") === "true") {
                log.add(`Extra action: ${data.action}`);
            }
            return;
        }
        // TODO: Delayed events... (green soul, discard (for example, sans))
        var card, you, enemy;
        // Battle logging happens after the game runs
        switch (data.action) {
            case "getAllGameInfos": // Initialize "spectate" history here
                // board = [0, 1, 2, 3, 4, 5, 6, 7, 8]
                // ---- typeCard: 0 = enemy; 1: spell
                // -- card: {attack, hp, maxHp, originalAttack, originalHp, paralyzed, silence, poisoned, taunt, id, typeCard, name, image, cost, description, rarity, shiny, quantity}
                // TODO: turnTime monitoring
                you = JSON.parse(data.you);
                enemy = JSON.parse(data.enemy);
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
                    card.desc = getDescription(card);
                    monsters[card.id] = card;
                });
                // Gracefully fallthrough
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
                $("div#history div.handle").html('').append(`[${data.gameType}] `, make.player(you), ' vs ', make.player(enemy));
                log.add(`Turn ${turn}`);
                if (data.userTurn) {
                    currentTurn = data.userTurn;
                    log.add(make.player(players[data.userTurn]), "'s turn");
                }
                break;
            case "getFight": // monster attack monster
                log.add(make.card(monsters[data.attackMonster]), ' attacked ', make.card(monsters[data.defendMonster]));
                break;
            case "getFightPlayer": // monster attacking player
                log.add(make.card(monsters[data.attackMonster]), ' attacked ', make.player(players[data.defendPlayer]));
                break;
            case "getUpdatePlayerHp":
                var oHp = players[data.playerId].hp;
                var hp = data.isDamage ? oHp - data.hp : data.hp - oHp;
                players[data.playerId].hp = data.hp;
                if (oHp !== data.hp) { // If the player isn't at 0 hp already
                    log.add(make.player(players[data.playerId]), ` ${data.isDamage ? "lost" : "gained"} ${hp} hp`);
                }
                if (data.hp === 0 && players[data.playerId].lives > 1 && !players[data.playerId].hasOwnProperty("lostLife")) { // If they have extra lives, and they didn't lose a life already
                    log.add(make.player(players[data.playerId]), ' lost a life');
                    players[data.playerId].lostLife = true;
                }
                break;
            case "getDoingEffect":
                // affecteds: [ids]; monsters affected
                // playerAffected1: id; player affected
                // playerAffected2: id; player affected
                // TODO: Figure out how to do this better
                if (lastEffect === data.monsterId) return;
                lastEffect = data.monsterId;
                log.add(make.card(monsters[data.monsterId]), "'s effect activated.");
                break;
            case "getSoulDoingEffect":
                if (lastEffect === data.playerId - 2) return;
                lastEffect = data.playerId - 2;
                log.add(make.player(players[data.playerId]), "'s soul activated.");
                // affecteds
                // playerAffected1
                // playerAffected2
                break;
            case "getTurnStart":
                lastEffect = 0;
                if (data.numTurn !== turn) {
                    log.add(`Turn ${data.numTurn}`);
                }
                currentTurn = data.idPlayer; // It would (kindof) help to actually update who's turn it is
                turn = data.numTurn;
                log.add(make.player(players[currentTurn]), "'s turn");
                break;
            case "getTurnEnd":
                // Lets switch the turn NOW, rather than later, the purpose of this is currently unknown... It just sounded like a good idea, also delete the "lostLife" flag...
                if (time <= 0) {
                    log.add(make.player(players[currentTurn]), ' timedout');
                }
                delete players[currentTurn].lostLife;
                currentTurn = other[data.idPlayer];
                delete players[currentTurn].lostLife;
                lastEffect = 0;
                break;
            case "getUpdateBoard":
                var oldMonsters = monsters;
                monsters = {};
                // TOOD: stuff....
                JSON.parse(data.board).forEach(function (card) {
                    if (card === null) return;
                    card.desc = getDescription(card);
                    monsters[card.id] = card;
                });
                break;
            case "getMonsterDestroyed":
                // monsterId: #
                log.add(make.card(monsters[data.monsterId]), ' was killed');
                delete monsters[data.monsterId];
                break;
            case "getCardBoard": // Adds card to X, Y (0(enemy), 1(you))
                card = JSON.parse(data.card);
                card.desc = getDescription(card);
                monsters[card.id] = card;
                log.add(make.player(players[data.idPlayer]), ' played ', make.card(card));
                break;
            case "getSpellPlayed":
                // immediately calls "getDoingEffect" and "getUpdateBoard"
                card = JSON.parse(data.card);
                card.desc = getDescription(card);
                monsters[card.id] = card;
                log.add(make.player(players[data.idPlayer]), ' used ', make.card(card));
                break;
            case "getCardDestroyedHandFull":
                card = JSON.parse(data.card);
                card.desc = getDescription(card);
                debug(data.card);
                // This event gets called for *all* discards. Have to do smarter logic here (not just currentTurn!)
                log.add(make.player(players[currentTurn]), ' discarded ', make.card(card));
                break;
            case "getPlayersStats": // TODO: When does this get called?
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
                // data.artifcats
                // data.turn
                break;
            case "getVictoryDeco":
                log.add(make.player(players[opponentId]), " left the game");
                // Gracefully fallthrough
            case "getVictory":
                finished = true;
                log.add(make.player(players[userId]), ' beat ', make.player(players[opponentId]));
                break;
            case "getDefeat":
                finished = true;
                log.add(make.player(players[opponentId]), ' beat ', make.player(players[userId]));
                break;
            case "getResult":
                finished = true;
                if (data.cause === "Surrender") {
                    log.add(`${data.looser} surrendered.`);
                } else if (data.cause === "Disconnection") {
                    log.add(`${data.looser} disconnected.`);
                }
                log.add(`${data.winner} beat ${data.looser}`);
                break;
            case "refreshTimer": break; // Probably don't need this
            case "getPlayableCards": // Probably don't need this
                // playableCards [#...]
                break;
            case "updateMonster":
                // monster {card}
                break;
            case "updateSpell": break; // Use spell
            case "getFakeDeath": break; // Card fake exploded... will be re-added 1 second later?
            default:
                if (localStorage.getItem("debugging") === "true") {
                    log.add(`Unknown action: ${data.action}`);
                }
        }
    });
});

// === Play hooks
onPage("Play", function () {
    // TODO: Better "game found" support
    debug("On play page");
    var queues, disable = true;

    eventManager.on("jQuery", function onPlay() {
        if (disable) {
            queues = $("button.btn.btn-primary");
            queues.prop("disabled", true);
        }
    });

    (function hook() {
        if (typeof socketQueue === "undefined") {
            debug("Timeout hook");
            return setTimeout(hook);
        }
        socket = socketQueue;
        var oOpen = socketQueue.onopen;
        socketQueue.onopen = function onOpenScript(event) {
            disable = false;
            oOpen(event);
            if (queues) queues.prop("disabled", false);
        };
        var oHandler = socketQueue.onmessage;
        socketQueue.onmessage = function onMessageScript(event) {
            var data = JSON.parse(event.data);
            oHandler(event);
            eventManager.emit(data.action, data);
        };
    })();
});

// === Game hooks
onPage("Game", function () {
    debug("Playing Game");
    (function hook() {
        if (typeof socket === "undefined") {
            debug("Timeout hook");
            return setTimeout(hook);
        }
        var oHandler = socket.onmessage;
        socket.onmessage = function onMessageScript(event) {
            var data = JSON.parse(event.data);
            //debug(event.data);
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
onPage("gameSpectate", function () {
    debug("Spectating Game");
    eventManager.emit("GameStart");
    (function hook() {
        if (typeof socket === "undefined") {
            debug("Timeout hook");
            return setTimeout(hook);
        }
        var oHandler = socket.onmessage;
        socket.onmessage = function onMessageScript(event) {
            oHandler(event);
            eventManager.emitJSON("GameEvent", event.data);
        };
    })();
});

// === Always do the following - if jquery is loaded
eventManager.on("jQuery", function always() {
    // Bind hotkey listeners
    $(document).on("click.script", function (event) {
        if (false) return; // TODO: Check for clicking in chat
        hotkeys.forEach(function (v) {
            if (v.clickbound(event.which)) {
                v.run(event);
            }
        });
    });
    $(document).on("keyup.script", function (event) {
        if ($(event.target).is("input")) return; // We don't want to listen while typing in chat (maybe listen for F-keys?)
        hotkeys.forEach(function (v) {
            if (v.keybound(event.which)) {
                v.run(event);
            }
        });
    });
    /* This legacy code doesn't work
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
    // */
});

// Attempt to detect jQuery
var tries = 20;
(function jSetup() {
    if (typeof jQuery === "undefined") {
        if (tries-- <= 0) { // jQuery is probably not going to load at this point...
            return;
        }
        setTimeout(jSetup, 1);
        return;
    }
    eventManager.emit("jQuery");
})();
