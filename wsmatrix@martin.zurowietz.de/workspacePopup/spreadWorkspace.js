import GObject from 'gi://GObject';
import Graphene from 'gi://Graphene';
import {Workspace} from 'resource:///org/gnome/shell/ui/workspace.js';
import {ControlsState, OverviewAdjustment} from 'resource:///org/gnome/shell/ui/overviewControls.js';

// Windows the overview would show for this workspace on this monitor, leaving out `leaving`,
// a window that is on its way out but still listed.
export function overviewWindowCount(workspace, monitorIndex, leaving = null) {
    return workspace.list_windows()
        .filter(w => w !== leaving && !w.skip_taskbar && !w.is_on_all_workspaces() &&
            w.get_monitor() === monitorIndex).length;
}

// A popup cell that lays its windows out side by side like the overview's window picker,
// each with its app icon, so windows that overlap on screen don't hide each other.
export default GObject.registerClass(
class SpreadWorkspace extends Workspace {
    _init(metaWorkspace, monitorIndex) {
        // Held at the window picker: nothing animates it, so the layout stays put.
        const overviewAdjustment = new OverviewAdjustment(null);
        overviewAdjustment.value = ControlsState.WINDOW_PICKER;
        // If construction fails partway, destroy whatever got built (signals, previews,
        // background) instead of leaking it; _createThumbnail's catch has no reference to it.
        try {
            super._init(metaWorkspace, monitorIndex, overviewAdjustment);

            // Scaled into the cell from its top left corner, like the thumbnails.
            this.pivot_point = new Graphene.Point({x: 0, y: 0});
            // Titles and close buttons need room the cell doesn't have.
            const layout = this._container.layout_manager;
            layout._syncOverlay = preview => (preview.overlayEnabled = false);
            layout.syncOverlays();
            this.stateAdjustment.value = 1;

            // GNOME eases each preview in from scale 0, but the spread layout is static
            // while the popup is up, so finish that entrance animation right away.
            for (const preview of this._windows) {
                preview.remove_all_transitions();
                preview.set_scale(1, 1);
            }
        } catch (e) {
            this.destroy();
            throw e;
        }
    }

    // The preview claims the window's _delegate, which the overview's drag and drop reads,
    // and clears it when destroyed. Give back what was there before.
    // A window on all workspaces is in every spread cell, so look past another cell's preview.
    _addWindowClone(metaWindow) {
        const previous = metaWindow._delegate;
        const delegate = previous?._workspace instanceof SpreadWorkspace
            ? previous._popupDelegate : previous;
        const clone = super._addWindowClone(metaWindow);
        clone._popupDelegate = delegate;
        clone.connect('destroy', () => (metaWindow._delegate = delegate));
        return clone;
    }

    // The cell's button handles clicks and hover; nothing inside the cell may take them.
    vfunc_pick(_context) {
    }

    setScale(scaleX, scaleY) {
        this.set_scale(scaleX, scaleY);
    }
});
