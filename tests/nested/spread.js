
// Popup cells spread out the windows of workspaces with more than one, like the overview.
// Opens real windows: small GTK 4 windows started from inside the nested shell, so they
// connect to its display.
function scenario(ext, T) {
    const settings = ext.getSettings();
    const procs = [];
    const open = title => procs.push(Gio.Subprocess.new(['gjs', '-c', `
        imports.gi.versions.Gtk = '4.0';
        const {Gtk, GLib} = imports.gi;
        Gtk.init();
        new Gtk.Window({title: '${title}', default_width: 900, default_height: 600}).present();
        new GLib.MainLoop(null, false).run();`], Gio.SubprocessFlags.NONE));
    const window = title => global.get_window_actors()
        .map(a => a.meta_window).find(w => w.get_title() === title);
    const Clutter = imports.gi.Clutter;
    const openPopup = () => ext.overrideWorkspace._showWorkspaceSwitcherPopup(true);
    const closePopup = () => ext.overrideWorkspace._destroyWorkspaceSwitcherPopup();
    const cells = () => T.popup()._items;
    const kind = i => cells()[i].constructor.name;
    const buttons = () => T.popup()._switcherList._items;
    const overlap = (a, b) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
    let delegates;

    return [
        [2200, () => ['A', 'B', 'C'].forEach(open)],
        [4500, () => {
            T.expect('test windows opened', ['A', 'B', 'C'].map(t => !!window(t)), [true, true, true]);
            window('C')?.change_workspace_by_index(1, false);
        }],
        [4700, () => T.expect('window C moved to workspace 2',
            window('C')?.get_workspace().index(), 1)],
        [4800, () => {
            delegates = ['A', 'B'].map(t => window(t)?._delegate);
            openPopup();
        }],
        [4850, () => T.expect('spread windows appear without growing in',
            cells()[0]._windows.map(p => [p.scale_x, p.scale_y]), [[1, 1], [1, 1]])],
        [5300, () => {
            T.expect('a workspace with two windows gets a spread cell', kind(0), 'SpreadWorkspace');
            T.expect('a workspace with one window keeps its thumbnail', kind(1), 'WorkspaceThumbnail');
            T.expect('an empty workspace keeps its dot', buttons()[2]._emptyDot.visible, true);
            T.shot('spread-popup');
        }],
        [5350, () => {
            const previews = cells()[0]._windows;
            T.expect('both windows are in the spread cell', previews.length, 2);
            const [a, b] = previews.map(p => p.get_allocation_box());
            T.expect('spread windows do not overlap', overlap(a, b), false);
            T.expect('each window shows its app icon',
                previews.map(p => p._icon.visible && p._icon.opacity > 0), [true, true]);
            T.expect('titles stay hidden', previews.map(p => p._title.visible), [false, false]);
        }],
        [5400, () => {
            // Clicks and hover belong to the cell's button, not to the windows inside it.
            const preview = cells()[0]._windows[0];
            const [x, y] = preview.get_transformed_position();
            const [w, h] = preview.get_transformed_size();
            const hit = global.stage.get_actor_at_pos(Clutter.PickMode.REACTIVE, x + w / 2, y + h / 2);
            T.expect('the cell button takes the pointer', buttons()[0].contains(hit), true);
            T.expect('nothing inside the spread cell takes the pointer', cells()[0].contains(hit), false);
        }],
        [5450, () => closePopup()],
        [5700, () => T.expect('windows get their drag-and-drop delegate back',
            ['A', 'B'].map(t => window(t)?._delegate === delegates.shift()), [true, true])],
        [5800, () => {
            openPopup();
            // Changing the setting closes the open popup, so the next one is rebuilt.
            settings.set_boolean('spread-windows', false);
        }],
        [5900, () => T.expect('turning the setting off closes the popup', !!T.popup(), false)],
        [6000, () => openPopup()],
        [6400, () => {
            T.expect('with the setting off the cell is a thumbnail', kind(0), 'WorkspaceThumbnail');
            closePopup();
            settings.set_boolean('spread-windows', true);
        }],
        [9000, () => procs.forEach(p => p.force_exit())],
    ];
}
