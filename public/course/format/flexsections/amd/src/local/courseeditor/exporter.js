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

import Exporter from "core_courseformat/local/courseeditor/exporter";

/**
 * Overriding default course format exporter
 *
 * @module     format_flexsections/local/courseeditor/exporter
 * @copyright  2022 Marina Glancy
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
export default class extends Exporter {
    // Extends: course/format/amd/src/local/courseeditor/exporter.js

    /**
     * Generate a section export data from the state.
     *
     * @param {Object} state the current state.
     * @param {Object} sectioninfo the section state data.
     * @returns {Object}
     */
    section(state, sectioninfo) {
        const children = sectioninfo.children;
        const section = super.section(state, sectioninfo);
        section.children = [];
        if (children && children.length) {
            for (let i = 0; i < children.length; i++) {
                section.children.push(this.section(state, children[i]));
            }
        }
        return section;
    }

    /**
     * Generate the course export data from the state.
     *
     * Unlike the default implementation, this also includes tabs (virtual top-level
     * sections with the format option 'parent' set to -1) as top-level entries so that
     * they can be picked as a destination in the "Move section"/"Move activity" dialogs
     * and shown in the course index. Tabs are deliberately excluded from
     * state.course.sectionlist (see classes/output/courseformat/state/course.php) because
     * the generic reactive DOM reordering code expects that list to only contain ids of
     * elements that are direct children of the section list, which is not the case for a
     * tab (it is rendered nested inside its own tab pane).
     *
     * @param {Object} state the current state.
     * @returns {Object}
     */
    course(state) {
        const course = {
            sections: [],
            editmode: this.reactive.isEditing,
            highlighted: state.course.highlighted ?? '',
        };
        const topSectionIds = state.course.topsectionlist ?? state.course.sectionlist ?? [];
        topSectionIds.forEach(sectionid => {
            const sectioninfo = state.section.get(sectionid) ?? {};
            course.sections.push(this.section(state, sectioninfo));
        });
        course.hassections = (course.sections.length != 0);
        course.maxsectiondepth = state.course.maxsectiondepth;
        return course;
    }

    /**
     * Return a sorted list of all sections and cms items in the state.
     *
     * @param {Object} state the current state.
     * @returns {Array} all sections and cms items in the state.
     */
    allItemsArray(state) {
        const items = [];
        const sectionlist = state.course.sectionlist ?? [];

        const addCms = (sectioninfo) => {
            const cmlist = sectioninfo.cmlist ?? [];
            cmlist.forEach(cmid => {
                const cminfo = state.cm.get(cmid);
                items.push({type: 'cm', id: cminfo.id, url: cminfo.url});
            });
        };
        const addChildItems = (children) => {
            if (children && children.length) {
                for (let i = 0; i < children.length; i++) {
                    const child = children[i];
                    items.push({type: 'section', id: child.id, url: child.sectionurl});
                    addCms(child);
                    addChildItems(child.children);
                }
            }
        };
        sectionlist.forEach(sectionid => {
            const sectioninfo = state.section.get(sectionid);
            items.push({type: 'section', id: sectioninfo.id, url: sectioninfo.sectionurl});
            addCms(sectioninfo);
            addChildItems(sectioninfo.children);
        });
        return items;
    }
}