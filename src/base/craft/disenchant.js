onPage('Crafting', function disenchant() {
  eventManager.on('jQuery', () => {
    const button = $('<button class="btn btn-info">Smart Disenchant</button>');
    button.click(onclick)
    // Add Disenchant Siny button
    $('#dust').after(' ', button);
  });

  function onclick() {
    const normals = calcCards({shiny: false});
    const shinies = calcCards({shiny: true});
    //const pNormal = calcCards(false, true);
    //const pShiny = calcCards(true, true);
    BootstrapDialog.show({
      title: 'Smart Disenchant',
      message: `Note: Smart Disenchant will only disenchant Legendary or lower cards.<br>
      Normal/Shiny will disenchant <b>ALL</b> normal/shiny cards until you have 0.`, //<br>Prioritize will count your normal/shiny cards and disenchant extra cards until you have exactly max for that rarity (favoring the type).`,
      onshow(dialog) {
        //const window = dialog.getModalBody();
      },
      buttons: [{
        label: `All Normal (+${calcDust(normals)} dust)`,
        cssClass: 'btn-danger btn-ff',
        action(dialog) {
          disenchant(normals);
          dialog.close();
        },
      },{
        label: `All Shiny (+${calcDust(shinies)} dust)`,
        cssClass: 'btn-danger btn-tf',
        action(dialog) {
          disenchant(shinies);
          dialog.close();
        },
      },/*{
        label: `Prioritize Normal (+${calcDust(pNormal)} dust)`,
        cssClass: 'btn-danger btn-ft',
        action(dialog) {
          disenchant(pNormal);
          dialog.close();
        },
      },{
        label: `Prioritize Shiny (+${calcDust(pShiny)} dust)`,
        cssClass: 'btn-danger bnt-tt',
        action(dialog) {
          disenchant(pShiny);
          dialog.close();
        },
      },*/],
    });
  }

  function updateOrToast(toast, message) {
    if (toast.exists()) {
      toast.setText(message);
    } else {
      fn.toast(message);
    }
  }

  function disenchant(cards) {
    if (!cards.length) return;
    const toast = fn.toast('Please wait while disenchanting shinies.<br />(this may take a while)');
    axios.all(build(cards))
      .then(process)
      .then((response) => {
        if (!response) throw new Error('All errored out');
        const data = response.data;
        const gained = data.dust - parseInt($('#dust').text());
        $('#dust').text(data.dust);
        $('#totalDisenchant').text(data.totalDisenchant);
        $('#nbDTFragments').text(data.DTFragments);
        $('#btnCraftDT').prop('disabled', data.DTFragments < 2);

        if (data.DTFragments) {
          $('#DTFragmentsDiv').show();
        }
        updateOrToast(toast, `Finished disenchanting.\n+${gained} dust`);
      }).catch(() => {
        updateOrToast(toast, 'Could not complete disenchanting.');
      });
  }

  function build(cards) {
    const promises = [];
    cards.forEach((data) => {
      for (let x = 0; x < data.quantity; x++) {
        promises.push(axios.post('CraftConfig', {
          action: 'disenchant',
          idCard: parseInt(data.id),
          isShiny: data.shiny,
        }, {
          headers: {
            'Content-Type': 'application/json',
          },
        }));
      }
    });
    debug(cards);
    debug(promises.length);
    return promises;
  }

  function process(responses) {
    // Decrease count for each response
    let last = null;
    const redo = [];
    responses.forEach((response) => {
      if (response.data === '') {
        const {idCard, isShiny} = JSON.parse(response.config.data);
        redo.push({
          quantity: 1,
          id: idCard,
          shiny: isShiny,
        });
        return;
      }
      debug(response);
      if (response.data.status !== 'success') {
        return;
      }
      // There's no guarantee this is in order
      if (!last || response.data.dust > last.data.dust) {
        debug('set');
        last = response;
      }
      const quantity = cardHelper.find(response.data.cardId, response.data.shiny).querySelector(`#quantity .nb`);
      quantity.textContent = parseInt(quantity.textContent) - 1;
    });
    if (redo.length) {
      debug(`Redoing ${redo.length}`);
      return axios.all(build(redo)).then(process);
    }
    debug('last', last);
    return last;
  }

  function calcCards({shiny, priority, deltarune}) {
    const cards = {};
    const extras = [];
    $('table.cardBoard').filter(function() {
      // Don't include DT/unknown cards
      return include(cardHelper.rarity(this), cardHelper.shiny(this));
    }).filter(function() {
      // We want to calculate all cards for "priority", otherwise we only want shiny/normals
      return priority || cardHelper.shiny(this) === shiny;
    }).filter(function() {
      // We only care if we actually have cards to remove
      return cardHelper.craft.quantity(this) > 0;
    }).each(function() {
      const id = this.id;
      const quantity = cardHelper.craft.quantity(this);
      const rarity = cardHelper.rarity(this);
      if (priority) {
        if (!cards.hasOwnProperty(id)) {
          const max = cardHelper.craft.max(rarity);
          if (!max) return;
          cards[id] = {
            max, rarity,
            name: cardHelper.name(this),
          };
        }
        const isShiny = cardHelper.shiny(this);
        cards[id][isShiny?'shiny':'normal'] = quantity;
      } else {
        extras.push({
          id, rarity, quantity, shiny,
          name: cardHelper.name(this),
        });
      }
    });
    if (priority) {
      // Calculate extras
      fn.each(cards, function(data, id) {
        const name = data.name;
        const rarity = data.rarity;
        if (data.shiny && data.normal) {
          const prioritized = shiny ? data.shiny : data.normal;
          const other = shiny ? data.normal : data.shiny;
          if (prioritized > data.max) {
            extras.push({
              id, shiny, rarity, name,
              quantity: prioritized - max,
            });
          }
          const slots = Math.max(data.max - prioritized, 0);
          if (other > slots) {
            extras.push({
              id, rarity, name,
              shiny: !shiny,
              quantity: other - slots,
            });
          }
        } else {
          const quantity = data.shiny || data.normal;
          const max = data.max;
          if (quantity > max) {
            extras.push({
              id, rarity, name,
              quantity: quantity - max,
              shiny: !!data.shiny,
            });
          }
        }
      });
    }
    return extras;
  }

  function calcDust(cards) {
    let total = 0;
    cards.forEach((card) => {
      total += cardHelper.craft.worth(card.rarity, card.shiny) * card.quantity;
    });
    return total;
  }

  function include(rarity, shiny) {
    switch (rarity) {
      case 'BASE': return shiny;
      default: fn.debug(`Unknown Rarity: ${rarity}`);
      case 'GENERATED':
      case 'DETERMINATION': return false;
      case 'LEGENDARY':
      case 'EPIC':
      case 'RARE':
      case 'COMMON': return true;
    }
  }
});