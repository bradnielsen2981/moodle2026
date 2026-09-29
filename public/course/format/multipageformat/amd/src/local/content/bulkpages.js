// This file is part of Moodle - http://moodle.org/
//
// Moodle is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// Moodle is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with Moodle.  If not, see <http://www.gnu.org/licenses/>.

/**
 * Hides the bulk "Move" action while a page's top section (its Tab) is selected.
 *
 * A page can only be moved as a whole, with the Move option of its own section menu (see
 * format_multipageformat/movepage). Core's bulk edit tools show and hide their actions with
 * d-none on every selection change, so this uses a class of its own (see styles.css) that
 * core never touches.
 *
 * @module     format_multipageformat/local/content/bulkpages
 * @copyright  2026 Brad Nielsen
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {BaseComponent} from 'core/reactive';
import {getCurrentCourseEditor} from 'core_courseformat/courseeditor';

const SELECTORS = {
    MOVEACTION: `[data-for="bulkaction"][data-action="moveSection"]`,
    ACTIONTOOL: `[data-for="bulkactions"] li`,
};

const CLASSES = {
    HIDE: 'format-multipageformat-bulkhidden',
};

class BulkPages extends BaseComponent {

    /**
     * Constructor hook.
     *
     * @param {Object} descriptor the component descriptor
     */
    create(descriptor) {
        this.name = 'format_multipageformat_bulkpages';
        this.pageids = new Set(descriptor.pageids.map(String));
    }

    /**
     * Component watchers.
     *
     * @returns {Array} of watchers
     */
    getWatchers() {
        return [
            {watch: `bulk:updated`, handler: this._refreshMove},
        ];
    }

    /**
     * Hide the bulk Move action if the selection has a page's top section in it.
     *
     * @param {object} param
     * @param {Object} param.element the bulk state
     */
    _refreshMove({element: bulk}) {
        const haspage = bulk.selectedType === 'section' && bulk.selection.some(id => this.pageids.has(String(id)));
        document.querySelectorAll(SELECTORS.MOVEACTION).forEach(action => {
            action.closest(SELECTORS.ACTIONTOOL)?.classList.toggle(CLASSES.HIDE, haspage);
        });
    }
}

/**
 * Start hiding the bulk Move action for pages.
 *
 * @param {Array} tabs array of {sectionid, childsectionids} as passed to format_multipageformat/tabs
 */
export const init = (tabs) => {
    const courseEditor = getCurrentCourseEditor();
    if (!courseEditor.supportComponents || !courseEditor.isEditing) {
        return;
    }
    new BulkPages({
        element: document.getElementById('page'),
        reactive: courseEditor,
        pageids: tabs.map(tab => tab.sectionid),
    });
};
