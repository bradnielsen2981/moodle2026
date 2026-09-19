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
 * Course section component for format_multipageformat.
 *
 * Two changes from core:
 *
 * 1. Adds a second, inner dropzone covering the section's own content area (below its
 *    header), so dragging one section onto the body of another nests it as a subsection
 *    instead of reordering it. The section's existing header-level dropzone (inherited,
 *    unchanged) keeps doing plain reordering, exactly as core does today.
 *
 *    The two dropzones never fight over the same drag: the inner one only validates
 *    section-type drops, and native drag&drop events reach it before they reach the outer
 *    dropzone (it is a descendant element), so it can stop the event there. Cm and file
 *    drops it declines to validate simply carry on to the outer dropzone untouched.
 *
 * 2. Makes subsection headers draggable too (core deliberately excludes delegated
 *    sections, see format_multipageformat/local/content/section/header), and reroutes a
 *    dropped subsection to the sectionDetach mutation instead of core's sectionMoveAfter,
 *    so dragging it out of its parent onto the main section list detaches it - reusing
 *    the exact same "drop line" indicator already used for reordering.
 *
 * @module     format_multipageformat/local/content/section
 * @copyright  2026 Brad Nielsen
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import Section from 'core_courseformat/local/content/section';
import Header from 'format_multipageformat/local/content/section/header';
import {DragDrop} from 'core/reactive';

export default class extends Section {

    /**
     * Initial state ready method.
     *
     * @param {Object} state the initial state
     */
    stateReady(state) {
        super.stateReady(state);
        this._configNestDropzone();
    }

    /**
     * Create a new Header object.
     *
     * @param {Element} sectionItem the Header's element
     * @return {Header} the new object
     */
    _newHeader(sectionItem) {
        return new Header({
            ...this,
            element: sectionItem,
            fullregion: this.element,
        });
    }

    /**
     * Drop event handler.
     *
     * A dropped section that is itself a subsection (delegated to another section) means
     * "detach me and put me here" rather than the usual "reorder me here".
     *
     * @param {Object} dropdata the accepted drop data
     * @param {Event} event the drop event
     */
    drop(dropdata, event) {
        if (dropdata?.type === 'section') {
            const draggedsection = this.reactive.get('section', dropdata.id);
            if (draggedsection?.component) {
                this.reactive.dispatch('sectionDetach', [dropdata.id], this.id);
                return;
            }
        }
        super.drop(dropdata, event);
    }

    /**
     * Validate if a dragged section can be reordered to be right after this one.
     *
     * A section that has become a Tab (page) is locked in place: it can never be moved at
     * all. None of its children can be moved to a position above (before) it either. This
     * only concerns plain reordering - a dragged section that is still delegated (still
     * nested inside another section) is handled by drop() above as a detach instead, and is
     * left untouched here.
     *
     * @param {Object} dropdata the exported drop data.
     * @returns {boolean}
     */
    validateDropData(dropdata) {
        if (dropdata?.type === 'section') {
            const draggedsection = this.reactive.get('section', dropdata.id);
            if (!draggedsection?.component && this._violatesTabLock(dropdata)) {
                return false;
            }
        }
        return super.validateDropData(dropdata);
    }

    /**
     * Whether dropping the dragged section right after this one would break the Tab locking
     * rule: a Tab can never be moved at all, and none of its children can move above it.
     *
     * Tab and tab-child relationships are not part of the reactive state (they are a
     * bespoke grouping on top of it), so they are read from the data attributes
     * format_multipageformat/tabs stamps on each section element while resolving them.
     *
     * @param {Object} dropdata the exported drop data.
     * @returns {boolean}
     */
    _violatesTabLock(dropdata) {
        if (!this.section) {
            return false;
        }
        const draggedEl = document.querySelector(`li[data-for="section"][data-id="${dropdata.id}"]`);
        if (!draggedEl) {
            return false;
        }

        // A Tab (page) is locked in place - it can never be moved at all, regardless of target.
        if (draggedEl.dataset.tabSection === 'true') {
            return true;
        }

        const tabParentId = draggedEl.dataset.tabParent;
        if (tabParentId) {
            const tabSection = this.reactive.get('section', Number(tabParentId));
            return !!(tabSection && this.section.number < tabSection.number);
        }

        return false;
    }

    /**
     * Set up the inner "nest into this section" dropzone.
     */
    _configNestDropzone() {
        if (!this.reactive.isEditing || !this.reactive.supportComponents) {
            return;
        }
        const content = this.getElement('.content');
        if (!content) {
            return;
        }
        this.nestdragdrop = new DragDrop({
            element: content,
            reactive: this.reactive,
            validateDropData: this._validateNestDropData.bind(this),
            showDropZone: this._showNestDropZone.bind(this),
            hideDropZone: this._hideNestDropZone.bind(this),
            drop: this._nestDrop.bind(this),
        });
    }

    /**
     * Remove all subcomponents dependencies.
     */
    destroy() {
        super.destroy();
        this.nestdragdrop?.unregister();
    }

    /**
     * Validate if a dragged section can be dropped into this section's content.
     *
     * @param {Object} dropdata the exported drop data.
     * @returns {boolean}
     */
    _validateNestDropData(dropdata) {
        if (dropdata?.type !== 'section') {
            return false;
        }
        // Sections controlled by a plugin cannot accept a nested section, and a section
        // cannot be nested into itself.
        if (this.section.component !== null || dropdata?.id == this.id) {
            return false;
        }
        // A section that is already a subsection must be detached first (drop it onto a
        // section header to do that) before it can be nested somewhere else.
        const draggedsection = this.reactive.get('section', dropdata.id);
        if (draggedsection?.component) {
            return false;
        }
        // A Tab (page) is locked in place - it can never be moved at all, including by
        // nesting it into another section.
        const draggedEl = document.querySelector(`li[data-for="section"][data-id="${dropdata.id}"]`);
        if (draggedEl?.dataset?.tabSection === 'true') {
            return false;
        }
        // Moodle's delegated section mechanism does not support subsections nested inside
        // subsections - a section that already contains one or more of its own subsections
        // must stay independent instead of becoming one itself.
        return !this._sectionHasSubsections(draggedsection);
    }

    /**
     * Whether a section (as found in the reactive state) contains one or more of its own
     * subsections.
     *
     * @param {Object} section the section state object
     * @returns {boolean}
     */
    _sectionHasSubsections(section) {
        return (section?.cmlist ?? []).some(cmid => this.reactive.get('cm', cmid)?.hasdelegatedsection);
    }

    /**
     * Display the "will become a subsection here" indicator.
     *
     * Mirrors exactly how the outer dropzone already shows where a dragged activity will
     * land: a line after the last item in the section (or after the section info box, if
     * the section has no content yet).
     */
    _showNestDropZone() {
        const target = this.getLastCm() ?? this.getLastCmFallback();
        target?.classList.add(this.classes.DROPDOWN);
    }

    /**
     * Hide the "will become a subsection here" indicator.
     */
    _hideNestDropZone() {
        const target = this.getLastCm() ?? this.getLastCmFallback();
        target?.classList.remove(this.classes.DROPDOWN);
    }

    /**
     * Nest the dragged section into this one.
     *
     * @param {Object} dropdata the accepted drop data
     */
    _nestDrop(dropdata) {
        this.reactive.dispatch('sectionAttach', [dropdata.id], this.id);
    }
}
