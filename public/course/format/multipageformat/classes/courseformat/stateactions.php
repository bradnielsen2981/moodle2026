<?php
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

namespace format_multipageformat\courseformat;

use core_courseformat\stateupdates;
use core_courseformat\stateactions as stateactions_base;
use core\event\course_module_updated;
use cm_info;
use section_info;
use stdClass;
use course_modinfo;
use moodle_exception;
use context_module;
use context_course;
use format_multipageformat\tabs_manager;
use mod_subsection\courseformat\sectiondelegate as subsection_sectiondelegate;
use core_courseformat\sectiondelegatemodule;

/**
 * Contains the core course state actions specific to multi page format.
 *
 * @package    format_multipageformat
 * @copyright  2022 Ferran Recio <ferran@moodle.com>
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class stateactions extends stateactions_base {

    /**
     * Highlight course section.
     *
     * @param stateupdates $updates the affected course elements track
     * @param stdClass $course the course object
     * @param int[] $ids section ids (only ther first one will be highlighted)
     * @param int $targetsectionid not used
     * @param int $targetcmid not used
     */
    public function section_highlight(
        stateupdates $updates,
        stdClass $course,
        array $ids = [],
        ?int $targetsectionid = null,
        ?int $targetcmid = null
    ): void {
        global $DB;

        $this->validate_sections($course, $ids, __FUNCTION__);
        $coursecontext = context_course::instance($course->id);
        require_capability('moodle/course:setcurrentsection', $coursecontext);

        // Get the previous marked section.
        $modinfo = get_fast_modinfo($course);
        $previousmarker = $DB->get_field("course", "marker", ['id' => $course->id]);

        $section = $modinfo->get_section_info_by_id(reset($ids), MUST_EXIST);
        if ($section->section == $previousmarker) {
            return;
        }

        // Mark the new one.
        $sectioninfo = get_fast_modinfo($course->id)->get_section_info($section->section);
        \core_courseformat\formatactions::section($course->id)->set_marker($sectioninfo, true);
        $updates->add_section_put($section->id);
        if ($previousmarker) {
            $section = $modinfo->get_section_info($previousmarker);
            $updates->add_section_put($section->id);
        }
    }

    /**
     * Remove highlight from a course sections.
     *
     * @param stateupdates $updates the affected course elements track
     * @param stdClass $course the course object
     * @param int[] $ids optional extra section ids to refresh
     * @param int $targetsectionid not used
     * @param int $targetcmid not used
     */
    public function section_unhighlight(
        stateupdates $updates,
        stdClass $course,
        array $ids = [],
        ?int $targetsectionid = null,
        ?int $targetcmid = null
    ): void {
        global $DB;

        $this->validate_sections($course, $ids, __FUNCTION__);
        $coursecontext = context_course::instance($course->id);
        require_capability('moodle/course:setcurrentsection', $coursecontext);

        $affectedsections = [];

        // Get the previous marked section and unmark it.
        $modinfo = get_fast_modinfo($course);
        $previousmarker = $DB->get_field("course", "marker", ['id' => $course->id]);
        \core_courseformat\formatactions::section($course->id)->remove_all_markers();
        $section = $modinfo->get_section_info($previousmarker, MUST_EXIST);
        $updates->add_section_put($section->id);

        foreach ($ids as $sectionid) {
            $section = $modinfo->get_section_info_by_id($sectionid, MUST_EXIST);
            if ($section->section != $previousmarker) {
                $updates->add_section_put($section->id);
            }
        }
    }

    /**
     * Delete course sections.
     *
     * Extends the default behaviour to also clean up any Tab relationship the deleted
     * sections had. Deleting a Tab (page) removes the Tab relationship for its children
     * too, since they can no longer be reached: their own content goes with the Tab, as
     * it lived in the Tab section's own activities.
     *
     * @param stateupdates $updates the affected course elements track
     * @param stdClass $course the course object
     * @param int[] $ids section ids to delete
     * @param int $targetsectionid not used
     * @param int $targetcmid not used
     */
    public function section_delete(
        stateupdates $updates,
        stdClass $course,
        array $ids = [],
        ?int $targetsectionid = null,
        ?int $targetcmid = null
    ): void {
        foreach ($ids as $sectionid) {
            if (tabs_manager::is_tab($sectionid)) {
                foreach (tabs_manager::get_children_sectionids($course->id, $sectionid) as $childsectionid) {
                    tabs_manager::remove($childsectionid);
                }
            }
            tabs_manager::remove($sectionid);
        }

        parent::section_delete($updates, $course, $ids, $targetsectionid, $targetcmid);
    }

    /**
     * Promote a section to a Tab (page).
     *
     * Any real Moodle subsections (mod_subsection activities) nested directly inside the
     * promoted section become children of the new Tab, so they appear as sections on it.
     *
     * @param stateupdates $updates the affected course elements track
     * @param stdClass $course the course object
     * @param int[] $ids section ids to promote
     * @param int $targetsectionid not used
     * @param int $targetcmid not used
     */
    public function section_makepage(
        stateupdates $updates,
        stdClass $course,
        array $ids = [],
        ?int $targetsectionid = null,
        ?int $targetcmid = null
    ): void {
        $this->validate_sections($course, $ids, __FUNCTION__);
        $coursecontext = context_course::instance($course->id);
        require_capability('moodle/course:update', $coursecontext);

        $modinfo = get_fast_modinfo($course);
        $coursesections = $modinfo->get_sections();

        foreach ($ids as $sectionid) {
            $section = $modinfo->get_section_info_by_id($sectionid, MUST_EXIST);

            // The General section (section 0) cannot become a page.
            if (!$section->section) {
                continue;
            }

            tabs_manager::set_as_tab($course->id, $section->id);
            $updates->add_section_put($section->id);

            // Any mod_subsection activities living directly in this section become
            // sections on the new page.
            $cmids = $coursesections[$section->section] ?? [];
            foreach ($cmids as $cmid) {
                $cm = $modinfo->get_cm($cmid);
                if ($cm->modname !== 'subsection' || !class_exists(subsection_sectiondelegate::class)) {
                    continue;
                }
                $childsectionid = subsection_sectiondelegate::delegated_section_id($cm);
                tabs_manager::set_tab_child($course->id, $childsectionid, $section->id);
                $updates->add_section_put($childsectionid);
            }
        }
    }

    /**
     * Move sections to a position right after a target section.
     *
     * A section that has become a Tab (page) is locked in place: it can never be moved at
     * all, by any means (dragging it, dragging another section onto/around it, etc). None of
     * its children can be moved to a position above (before) it either. Sections with no Tab
     * relationship at all, and moves that do not involve a Tab or one of its children, are
     * unrestricted.
     *
     * @param stateupdates $updates the affected course elements track
     * @param stdClass $course the course object
     * @param int[] $ids section ids to move
     * @param int|null $targetsectionid the section the moved sections will be placed after
     * @param int $targetcmid not used
     */
    public function section_move_after(
        stateupdates $updates,
        stdClass $course,
        array $ids = [],
        ?int $targetsectionid = null,
        ?int $targetcmid = null
    ): void {
        foreach ($ids as $sectionid) {
            if (tabs_manager::is_tab($sectionid)) {
                throw new moodle_exception('tabcannotbemoved', 'format_multipageformat');
            }
        }

        if ($targetsectionid) {
            $modinfo = get_fast_modinfo($course);
            $targetsection = $modinfo->get_section_info_by_id($targetsectionid, MUST_EXIST);

            foreach ($ids as $sectionid) {
                $tabid = tabs_manager::get_parent($sectionid);
                if ($tabid !== null && $tabid !== tabs_manager::TAB) {
                    $tabsection = $modinfo->get_section_info_by_id($tabid, IGNORE_MISSING);
                    if ($tabsection && $targetsection->sectionnum < $tabsection->sectionnum) {
                        throw new moodle_exception('tabmustremainontop', 'format_multipageformat');
                    }
                }
            }
        }

        parent::section_move_after($updates, $course, $ids, $targetsectionid, $targetcmid);
    }

    /**
     * Detach a subsection from its parent, turning it into its own independent section.
     *
     * Placed immediately after $targetsectionid if given (used when the subsection is
     * dragged out to a specific spot in the main section list), otherwise immediately
     * after the section it used to belong to (used by the "Make own section" menu item).
     *
     * @param stateupdates $updates the affected course elements track
     * @param stdClass $course the course object
     * @param int[] $ids subsection ids to detach
     * @param int|null $targetsectionid optional section to place the detached section after
     * @param int $targetcmid not used
     */
    public function section_detach(
        stateupdates $updates,
        stdClass $course,
        array $ids = [],
        ?int $targetsectionid = null,
        ?int $targetcmid = null
    ): void {
        global $DB;

        $this->validate_sections($course, $ids, __FUNCTION__);
        $coursecontext = context_course::instance($course->id);
        require_capability('moodle/course:update', $coursecontext);
        require_capability('moodle/course:manageactivities', $coursecontext);

        foreach ($ids as $sectionid) {
            $modinfo = get_fast_modinfo($course);
            $section = $modinfo->get_section_info_by_id($sectionid, MUST_EXIST);

            $delegate = $section->get_component_instance();
            if (!$delegate instanceof sectiondelegatemodule) {
                continue;
            }
            $parentsection = $delegate->get_parent_section();
            $cm = $delegate->get_cm();
            $anchorsectionid = $targetsectionid ?? $parentsection->id;

            // The anchor must be a normal, independent section.
            $anchorsection = $modinfo->get_section_info_by_id($anchorsectionid, MUST_EXIST);
            if ($anchorsection->component !== null) {
                continue;
            }

            // Detach the section from its delegate component before removing the
            // subsection activity: the activity's own delete_instance() looks the
            // section up by component/itemid, so detaching first stops it from
            // taking the section (and its contents) down with it.
            $DB->update_record('course_sections', (object) [
                'id' => $section->id,
                'component' => null,
                'itemid' => null,
                'timemodified' => time(),
            ]);
            course_modinfo::purge_course_section_cache_by_id($course->id, $section->id);
            rebuild_course_cache($course->id, true);

            // Reposition it right after the anchor section.
            $modinfo = get_fast_modinfo($course);
            $section = $modinfo->get_section_info_by_id($sectionid, MUST_EXIST);
            $anchorsection = $modinfo->get_section_info_by_id($anchorsectionid, MUST_EXIST);
            \core_courseformat\formatactions::section($course->id)->move_after($section, $anchorsection);

            // The subsection activity that used to host it no longer serves a purpose.
            \core_courseformat\formatactions::cm($course->id)->delete($cm->id);
        }

        $updates->add_course_put();
    }

    /**
     * Attach a section as a subsection of another section.
     *
     * Creates the subsection activity that will host it inside the target section, then
     * points the existing section at that activity, turning it into a delegated section.
     * The section keeps its own content - only its relationship to the rest of the course
     * changes.
     *
     * @param stateupdates $updates the affected course elements track
     * @param stdClass $course the course object
     * @param int[] $ids section ids to attach
     * @param int|null $targetsectionid the section that will become the parent
     * @param int $targetcmid not used
     */
    public function section_attach(
        stateupdates $updates,
        stdClass $course,
        array $ids = [],
        ?int $targetsectionid = null,
        ?int $targetcmid = null
    ): void {
        global $DB;

        if (!$targetsectionid) {
            throw new moodle_exception('Action section_attach requires targetsectionid');
        }

        $this->validate_sections($course, $ids, __FUNCTION__);
        $coursecontext = context_course::instance($course->id);
        require_capability('moodle/course:update', $coursecontext);
        require_capability('moodle/course:manageactivities', $coursecontext);

        $modinfo = get_fast_modinfo($course);
        $targetsection = $modinfo->get_section_info_by_id($targetsectionid, MUST_EXIST);
        if ($targetsection->component !== null) {
            // Sections controlled by a plugin cannot accept a nested section.
            return;
        }

        foreach ($ids as $sectionid) {
            if ($sectionid == $targetsectionid) {
                continue;
            }

            $modinfo = get_fast_modinfo($course);
            $section = $modinfo->get_section_info_by_id($sectionid, MUST_EXIST);
            $targetsection = $modinfo->get_section_info_by_id($targetsectionid, MUST_EXIST);

            if (!$section->section || $section->component !== null) {
                // The General section, and already-delegated sections, cannot be attached.
                continue;
            }

            if ($this->section_contains_subsections($modinfo, $section)) {
                // Moodle's delegated section mechanism does not support subsections nested
                // inside subsections - a section that already contains one or more of its
                // own subsections must stay independent instead of becoming one itself.
                continue;
            }

            if (tabs_manager::is_tab($section->id)) {
                // A Tab (page) is locked in place - it can never be moved at all, including
                // by nesting it into another section.
                continue;
            }
            tabs_manager::remove($section->id);

            $subsectioninstanceid = $this->create_subsection_instance($course, $targetsection, $section);

            // Point the existing section at the new activity, turning it into a
            // delegated section. This is the exact mirror of section_detach().
            $DB->update_record('course_sections', (object) [
                'id' => $section->id,
                'component' => 'mod_subsection',
                'itemid' => $subsectioninstanceid,
                'timemodified' => time(),
            ]);
            course_modinfo::purge_course_section_cache_by_id($course->id, $section->id);
            rebuild_course_cache($course->id, true);
        }

        $updates->add_course_put();
    }

    /**
     * Whether a section contains one or more of its own subsections (mod_subsection activities).
     *
     * @param course_modinfo $modinfo the course's modinfo
     * @param section_info $section the section to check
     * @return bool
     */
    protected function section_contains_subsections(course_modinfo $modinfo, section_info $section): bool {
        $coursesections = $modinfo->get_sections();
        $cmids = $coursesections[$section->section] ?? [];
        foreach ($cmids as $cmid) {
            if ($modinfo->get_cm($cmid)->modname === 'subsection') {
                return true;
            }
        }
        return false;
    }

    /**
     * Create a subsection activity inside the target section, to host a section being attached.
     *
     * @param stdClass $course the course object
     * @param section_info $targetsection the section that will host the new activity
     * @param section_info $section the section that will be delegated to the new activity
     * @return int the id of the new 'subsection' module instance
     */
    protected function create_subsection_instance(
        stdClass $course,
        section_info $targetsection,
        section_info $section
    ): int {
        global $DB, $CFG;
        require_once($CFG->dirroot . '/course/lib.php');

        $moduleid = $DB->get_field('modules', 'id', ['name' => 'subsection'], MUST_EXIST);

        $cm = new stdClass();
        $cm->course = $course->id;
        $cm->module = $moduleid;
        $cm->instance = 0;
        $cm->section = $targetsection->id;
        $cm->visible = $section->visible;
        $cm->visibleoncoursepage = 1;
        $cm->visibleold = $section->visible;
        $cm->groupmode = 0;
        $cm->groupingid = 0;
        $cmid = add_course_module($cm);

        $instanceid = $DB->insert_record('subsection', (object) [
            'course' => $course->id,
            'name' => $section->name ?: get_string('newsection', 'format_multipageformat'),
            'timemodified' => time(),
        ]);
        $DB->set_field('course_modules', 'instance', $instanceid, ['id' => $cmid]);

        course_add_cm_to_section($course, $cmid, $targetsection->sectionnum);

        rebuild_course_cache($course->id, true);
        $newcm = get_fast_modinfo($course)->get_cm($cmid);
        \core\event\course_module_created::create_from_cm($newcm)->trigger();

        return $instanceid;
    }
}
