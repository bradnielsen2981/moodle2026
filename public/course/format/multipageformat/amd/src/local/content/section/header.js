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
 * Course section header component for format_multipageformat.
 *
 * Core deliberately keeps delegated (subsection) headers non-draggable, since core has
 * nowhere for dragging one to go. This plugin does - dropping it back onto the main
 * section list detaches it (see format_multipageformat/local/content/section) - so this
 * override relaxes that one restriction and leaves everything else inherited unchanged.
 *
 * @module     format_multipageformat/local/content/section/header
 * @copyright  2026 Brad Nielsen
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Header from 'core_courseformat/local/content/section/header';
import {DragDrop} from 'core/reactive';

export default class extends Header {

    /**
     * Initial state ready method.
     *
     * This is a copy of the inherited configDragDrop() with the delegated-section
     * exclusion removed - section zero is still never draggable.
     *
     * @param {number} sectionid the section id
     * @param {Object} state the initial state
     * @param {Element} fullregion the complete section region to mark as dragged
     * @param {Boolean} isDndAllowed Whether drag and drop is allowed in this section.
     */
    configDragDrop(sectionid, state, fullregion, isDndAllowed = true) {
        this.id = sectionid;
        if (this.section === undefined) {
            this.section = state.section.get(this.id);
        }
        if (this.course === undefined) {
            this.course = state.course;
        }

        if (this.section.number > 0) {
            this.getDraggableData = this._getDraggableData;
        }

        this.fullregion = fullregion;

        if (this.reactive.isEditing && this.reactive.supportComponents && isDndAllowed) {
            this.dragdrop = new DragDrop(this);
            this.classes = this.dragdrop.getClasses();
        }
    }
}
