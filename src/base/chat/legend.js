wrap(() => {
  const setting = settings.register({
    name: 'Announcement',
    key: 'underscript.announcement.legend',
    options: ['Chat', 'Toast', 'Both', 'Hidden'],
    default: 'Toast',
    type: 'select',
    page: 'Chat',
    category: 'Legendary User',
  });

  const friends = settings.register({
    name: 'Friends Only',
    key: 'underscript.announcement.legend.friendsOnly',
    page: 'Chat',
    category: 'Legendary User',
  });

  const events = ['chat-new-legend'];
  eventManager.on('preChat:getMessageAuto', function legend(data) {
    const [type, user] = JSON.parse(JSON.parse(data.message).args);
    if (this.canceled || !events.includes(type)) return;
    const handling = setting.value();
    const friendsOnly = friends.value();
    if (handling === 'Chat' && !friendsOnly) return; // All default
    const hidden = handling === 'Hidden';
    this.canceled = hidden || handling === 'Toast';
    if (hidden) return;
    if (friendsOnly && !fn.isFriend(user)) {
      this.canceled = true;
      return;
    }
    fn.toast({
      text: global('translateFromServerJson')(data.message),
      css: {
        color: 'yellow',
        footer: { color: 'white' },
      },
    });
  });
});
