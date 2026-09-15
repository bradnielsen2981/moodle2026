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

import Section from 'core_courseformat/local/content/section';

/**
 * Course section format component.
 *
 * @module     format_flexsections/local/content/section
 * @copyright  2022 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
export default class extends Section {
    // Extends course/format/amd/src/local/content/section.js
    // Extends course/format/amd/src/local/courseeditor/dndsection.js

    /**
     * Validate if the drop data can be dropped over the component.
     *
     * Section drag-and-drop is restricted to reordering siblings (sections sharing the same
     * parent) only, similar to the Topics format's simple drag-and-drop reordering. Moving a
     * section to become a subsection of a different one (i.e. changing its 'parent' format
     * option in mdl_course_format_options) must go through the explicit "Move" action instead,
     * which validates depth/loops properly. Without this restriction, dropping a section next
     * to one belonging to a different tab (or a different subsection), or onto a tab itself,
     * would change the dragged section's parent - this makes sure that can never happen via
     * drag-and-drop, only via an explicit "Move" action.
     *
     * @param {Object} dropdata the exported drop data.
     * @returns {boolean}
     */
    validateDropData(dropdata) {
        if (dropdata?.type === 'section') {
            const draggedSection = this.reactive.get('section', dropdata.id);
            if (!draggedSection || draggedSection.parent !== this.section?.parent) {
                return false;
            }
        }
        return super.validateDropData(dropdata);
    }

    /**
     * Drop event handler.
     *
     * Section drops are dispatched to the dedicated sectionReorder mutation instead of the
     * generic sectionMoveAfter, because sectionReorder is guaranteed (server-side) to never
     * change the dragged section's parent - see
     * classes/courseformat/stateactions.php::section_reorder(). validateDropData() above
     * already only allows dropping onto a sibling, so this is always a same-parent reorder.
     *
     * @param {Object} dropdata the accepted drop data
     * @param {Event} event the drop event
     */
    drop(dropdata, event) {
        if (dropdata.type === 'section') {
            this.reactive.dispatch('sectionReorder', dropdata.id, this.id);
            return;
        }
        super.drop(dropdata, event);
    }
}