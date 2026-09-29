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
 * Page rules for dragging sections in the Course index drawer.
 *
 * Core builds the Course index sections itself (a format cannot swap their class the way it can
 * for the course content), so the drag and drop methods of core's Course index section are
 * extended here instead, once, for the pages of this course:
 *
 * - A page (its Tab section) can only be dropped on another page. Like the "Move page" dialog
 *   (see format_multipageformat/movepage), dropping it on a page above it moves it before that
 *   page and on a page below it moves it after that page, the whole page going with it.
 * - Any other section is refused where the server would refuse it (see
 *   format_multipageformat\courseformat\stateactions::section_move_after()): a page's section
 *   above its page, or any section right above a page.
 *
 * @module     format_multipageformat/local/courseindex/section
 * @copyright  2026 Brad Nielsen
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import CourseIndexSection from 'core_courseformat/local/courseindex/section';

const base = {
    validateDropData: CourseIndexSection.prototype.validateDropData,
    showDropZone: CourseIndexSection.prototype.showDropZone,
    drop: CourseIndexSection.prototype.drop,
};

/** @var {Map} the page (Tab section id) of every section on a page, Tabs included, keyed by section id */
let pageOf = null;

/**
 * Whether a section is a page (a Tab section).
 *
 * @param {number|string} id section id
 * @return {boolean}
 */
const isPage = (id) => pageOf.get(String(id)) === String(id);

/**
 * Whether dropping a dragged section right after a target section breaks a page rule.
 *
 * @param {Object} reactive the course editor
 * @param {Object} target the target section state
 * @param {Object} dragged the dragged section state
 * @return {boolean}
 */
const breaksPageRules = (reactive, target, dragged) => {
    // A section on a page cannot be placed above that page.
    const draggedpage = pageOf.get(String(dragged.id));
    if (draggedpage !== undefined) {
        const page = reactive.get('section', draggedpage);
        if (page && target.number < page.number) {
            return true;
        }
    }
    // Nothing can be placed right above a page. Right below a page's own sections is the end
    // of that page, not the top of the next, so it is fine.
    if (pageOf.has(String(target.id))) {
        return false;
    }
    const next = reactive.get('course').sectionlist
        .map(id => reactive.get('section', id))
        .filter(section => section && section.number > target.number && section.component === null && section.id != dragged.id)
        .sort((a, b) => a.number - b.number)[0];
    return next !== undefined && isPage(next.id);
};

/**
 * Validate if the drop data can be dropped over this Course index section.
 *
 * @param {Object} dropdata the exported drop data
 * @return {boolean}
 */
const validateDropData = function(dropdata) {
    if (dropdata?.type !== 'section') {
        return base.validateDropData.call(this, dropdata);
    }
    if (isPage(dropdata.id)) {
        return isPage(this.id) && dropdata.id != this.id;
    }
    const dragged = this.reactive.get('section', dropdata.id);
    if (this.section && dragged && breaksPageRules(this.reactive, this.section, dragged)) {
        return false;
    }
    return base.validateDropData.call(this, dropdata);
};

/**
 * Display the dropzone: above a page a dragged page will be moved before, below any other.
 *
 * @param {Object} dropdata the accepted drop data
 * @param {Event} event the drag event
 */
const showDropZone = function(dropdata, event) {
    if (dropdata?.type === 'section' && isPage(dropdata.id) && this.section.number < dropdata.number) {
        this.element.classList.remove(this.classes.DROPDOWN);
        this.element.classList.add(this.classes.DROPUP);
        return;
    }
    base.showDropZone.call(this, dropdata, event);
};

/**
 * Drop handler: a dropped page moves as a whole page.
 *
 * @param {Object} dropdata the accepted drop data
 * @param {Event} event the drop event
 */
const drop = function(dropdata, event) {
    if (dropdata?.type === 'section' && isPage(dropdata.id)) {
        this.reactive.dispatch('sectionMovePage', [Number(dropdata.id)], Number(this.id));
        return;
    }
    base.drop.call(this, dropdata, event);
};

/**
 * Apply the page rules to the Course index sections.
 *
 * @param {Array} tabs array of {sectionid, childsectionids} as passed to format_multipageformat/tabs
 */
export const init = (tabs) => {
    pageOf = new Map();
    tabs.forEach(tab => {
        pageOf.set(String(tab.sectionid), String(tab.sectionid));
        tab.childsectionids.forEach(id => pageOf.set(String(id), String(tab.sectionid)));
    });
    Object.assign(CourseIndexSection.prototype, {validateDropData, showDropZone, drop});
};
