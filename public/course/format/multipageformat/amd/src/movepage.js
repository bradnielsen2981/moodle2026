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
 * The "Move page" dialog for format_multipageformat.
 *
 * The Move option of a page's first section (its Tab) opens this instead of core's "Move
 * section" dialog. It only lists the pages of the course: the pages above the one being moved
 * read "Before <page>" and the pages below it "After <page>", so every position is one click
 * away and none of them is a no-op. The whole page moves, through the sectionMovePage mutation.
 *
 * @module     format_multipageformat/movepage
 * @copyright  2026 Brad Nielsen
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Modal from 'core/modal';
import Templates from 'core/templates';
import {get_string as getString} from 'core/str';
import {getCurrentCourseEditor} from 'core_courseformat/courseeditor';

/**
 * Plain text of a section title, which the course state holds as formatted HTML.
 *
 * @param {string} html
 * @return {string}
 */
const toText = (html) => new DOMParser().parseFromString(html ?? '', 'text/html').body.textContent.trim();

/**
 * Open the dialog to move a page.
 *
 * @param {Element} target the Move menu item that was clicked (its data-id is the page's Tab section id)
 * @param {Event} event the click event
 */
export const open = async(target, event) => {
    event.preventDefault();
    // Section ids are compared as strings: that is how the course state's section list holds them.
    const pageid = String(target.dataset.id);
    const courseEditor = getCurrentCourseEditor();

    // Tabs are not part of the course state, format_multipageformat/tabs marks them in the DOM.
    const tabids = new Set(
        [...document.querySelectorAll('li[data-for="section"][data-tab-section="true"]')].map(el => el.dataset.id)
    );
    const pageids = courseEditor.get('course').sectionlist.map(String).filter(id => tabids.has(id));
    const position = pageids.indexOf(pageid);
    if (position === -1) {
        return;
    }

    const title = (id) => toText(courseEditor.get('section', id)?.title);
    const pages = await Promise.all(pageids.map(async(id, index) => {
        if (index === position) {
            return {id, label: title(id), current: true};
        }
        const key = (index < position) ? 'movepagebefore' : 'movepageafter';
        return {id, label: await getString(key, 'format_multipageformat', title(id)), current: false};
    }));

    const modal = await Modal.create({
        title: getString('movepage_title', 'format_multipageformat'),
        body: Templates.render('format_multipageformat/local/movepage', {
            information: await getString('movepage_info', 'format_multipageformat', title(pageid)),
            pages,
        }),
        show: true,
        removeOnClose: true,
    });

    modal.getBody()[0].addEventListener('click', (event) => {
        const link = event.target.closest('a[data-for="page"]');
        if (!link) {
            return;
        }
        event.preventDefault();
        if (link.getAttribute('aria-disabled')) {
            return;
        }
        modal.destroy();
        courseEditor.dispatch('sectionMovePage', [Number(pageid)], Number(link.dataset.id));
    });
};
