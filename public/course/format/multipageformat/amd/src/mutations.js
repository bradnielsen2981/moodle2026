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
 * Format multipageformat mutations.
 *
 * An instance of this class will be used to add custom mutations to the course editor.
 * To make sure the addMutations method find the proper functions, all functions must
 * be declared as class attributes, not a simple methods. The reason is because many
 * plugins can add extra mutations to the course editor.
 *
 * @module     format_multipageformat/mutations
 * @copyright  2022 Ferran Recio <ferran@moodle.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {getCurrentCourseEditor} from 'core_courseformat/courseeditor';
import DefaultMutations from 'core_courseformat/local/courseeditor/mutations';
import CourseActions from 'core_courseformat/local/content/actions';

class MultipageformatMutations extends DefaultMutations {

    /**
     * Highlight sections.
     *
     * It is important to note this mutation method is declared as a class attribute,
     * See the class jsdoc for more details on why.
     *
     * @param {StateManager} stateManager the current state manager
     * @param {array} sectionIds the list of section ids
     */
    sectionHighlight = async function(stateManager, sectionIds) {
        const logEntry = this._getLoggerEntry(
            stateManager,
            'section_highlight',
            sectionIds,
            {component: 'format_multipageformat'}
        );
        const course = stateManager.get('course');
        this.sectionLock(stateManager, sectionIds, true);
        const updates = await this._callEditWebservice('section_highlight', course.id, sectionIds);
        stateManager.processUpdates(updates);
        this.sectionLock(stateManager, sectionIds, false);
        stateManager.addLoggerEntry(await logEntry);

    };

    /**
     * Unhighlight sections.
     *
     * It is important to note this mutation method is declared as a class attribute,
     * See the class jsdoc for more details on why.
     *
     * @param {StateManager} stateManager the current state manager
     * @param {array} sectionIds the list of section ids
     */
    sectionUnhighlight = async function(stateManager, sectionIds) {
        const logEntry = this._getLoggerEntry(
            stateManager,
            'section_unhighlight',
            sectionIds,
            {component: 'format_multipageformat'}
        );
        const course = stateManager.get('course');
        this.sectionLock(stateManager, sectionIds, true);
        const updates = await this._callEditWebservice('section_unhighlight', course.id, sectionIds);
        stateManager.processUpdates(updates);
        this.sectionLock(stateManager, sectionIds, false);
        stateManager.addLoggerEntry(await logEntry);
    };

    /**
     * Promote sections to Tabs (pages).
     *
     * The Tab strip is built once at page load from server-rendered data, so once the
     * mutation succeeds the page is reloaded to pick up the new Tab and any subsections
     * that were moved onto it.
     *
     * It is important to note this mutation method is declared as a class attribute,
     * See the class jsdoc for more details on why.
     *
     * @param {StateManager} stateManager the current state manager
     * @param {array} sectionIds the list of section ids
     */
    sectionMakePage = async function(stateManager, sectionIds) {
        const logEntry = this._getLoggerEntry(
            stateManager,
            'section_makepage',
            sectionIds,
            {component: 'format_multipageformat'}
        );
        const course = stateManager.get('course');
        this.sectionLock(stateManager, sectionIds, true);
        const updates = await this._callEditWebservice('section_makepage', course.id, sectionIds);
        stateManager.processUpdates(updates);
        stateManager.addLoggerEntry(await logEntry);
        window.location.reload();
    };

    /**
     * Attach a section as a subsection of another section.
     *
     * The section's own content stays with it; it just becomes nested inside the target
     * section instead of being a sibling. Since that changes the DOM structure quite a
     * bit, the page is reloaded once the mutation succeeds rather than trying to patch it.
     *
     * It is important to note this mutation method is declared as a class attribute,
     * See the class jsdoc for more details on why.
     *
     * @param {StateManager} stateManager the current state manager
     * @param {array} sectionIds the list of section ids to attach (only the first is used)
     * @param {number} targetSectionId the section that will become the parent
     */
    sectionAttach = async function(stateManager, sectionIds, targetSectionId) {
        if (!targetSectionId) {
            throw new Error(`Mutation sectionAttach requires targetSectionId`);
        }
        const logEntry = this._getLoggerEntry(
            stateManager,
            'section_attach',
            sectionIds,
            {component: 'format_multipageformat', targetSectionId}
        );
        const course = stateManager.get('course');
        this.sectionLock(stateManager, sectionIds, true);
        const updates = await this._callEditWebservice('section_attach', course.id, sectionIds, targetSectionId);
        stateManager.processUpdates(updates);
        stateManager.addLoggerEntry(await logEntry);
        window.location.reload();
    };

    /**
     * Detach a subsection from its parent, turning it into its own independent section
     * placed right after targetSectionId.
     *
     * The mirror of sectionAttach - see its comment for why this reloads the page rather
     * than patching the DOM.
     *
     * It is important to note this mutation method is declared as a class attribute,
     * See the class jsdoc for more details on why.
     *
     * @param {StateManager} stateManager the current state manager
     * @param {array} sectionIds the list of subsection ids to detach (only the first is used)
     * @param {number} targetSectionId the section the detached section should be placed after
     */
    sectionDetach = async function(stateManager, sectionIds, targetSectionId) {
        if (!targetSectionId) {
            throw new Error(`Mutation sectionDetach requires targetSectionId`);
        }
        const logEntry = this._getLoggerEntry(
            stateManager,
            'section_detach',
            sectionIds,
            {component: 'format_multipageformat', targetSectionId}
        );
        const course = stateManager.get('course');
        this.sectionLock(stateManager, sectionIds, true);
        const updates = await this._callEditWebservice('section_detach', course.id, sectionIds, targetSectionId);
        stateManager.processUpdates(updates);
        stateManager.addLoggerEntry(await logEntry);
        window.location.reload();
    };
}

export const init = () => {
    const courseEditor = getCurrentCourseEditor();
    // Some plugin (activity or block) may have their own mutations already registered.
    // This is why we use addMutations instead of setMutations here.
    courseEditor.addMutations(new MultipageformatMutations());
    // Add direct mutation content actions.
    CourseActions.addActions({
        sectionHighlight: 'sectionHighlight',
        sectionUnhighlight: 'sectionUnhighlight',
        sectionMakePage: 'sectionMakePage',
        sectionAttach: 'sectionAttach',
        sectionDetach: 'sectionDetach',
    });
};
