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
 * The "Add page" dialog for format_multipageformat.
 *
 * Asks for the name of the new page, then creates it through the sectionAddPage mutation.
 * The page's first section (its Tab) gets that name. The dialog is only built when the
 * "Add page" tab is clicked, so it adds nothing to the page load.
 *
 * @module     format_multipageformat/addpage
 * @copyright  2026 Brad Nielsen
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import ModalSaveCancel from 'core/modal_save_cancel';
import ModalEvents from 'core/modal_events';
import {get_strings as getStrings} from 'core/str';
import {getCurrentCourseEditor} from 'core_courseformat/courseeditor';

const escapeHtml = (text) => text.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
}[c]));

/**
 * Ask for a page name and create the page.
 */
export const open = async() => {
    const [title, label, defaultname, create] = await getStrings([
        {key: 'addpage', component: 'format_multipageformat'},
        {key: 'addpagenamelabel', component: 'format_multipageformat'},
        {key: 'addpagename', component: 'format_multipageformat'},
        {key: 'addpagecreate', component: 'format_multipageformat'},
    ]);

    const modal = await ModalSaveCancel.create({
        title,
        body: `<div class="mb-3">
                <label for="format-multipageformat-addpage-name" class="form-label">${escapeHtml(label)}</label>
                <input type="text" class="form-control" id="format-multipageformat-addpage-name"
                    maxlength="255" value="${escapeHtml(defaultname)}">
            </div>`,
        buttons: {save: create},
        show: true,
        removeOnClose: true,
    });

    const root = modal.getRoot()[0];
    const input = root.querySelector('#format-multipageformat-addpage-name');

    root.addEventListener(ModalEvents.shown, () => {
        input.focus();
        input.select();
    });
    // Enter in the field creates the page, like pressing the button.
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            root.querySelector('[data-action="save"]').click();
        }
    });
    modal.getRoot().on(ModalEvents.save, () => {
        const name = input.value.trim() || defaultname;
        getCurrentCourseEditor().dispatch('sectionAddPage', name);
    });
};
