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

namespace format_flexsections\output\courseformat;

use core_courseformat\external\get_state;
use course_modinfo;
use stdClass;

/**
 * Render a course content.
 *
 * @package   format_flexsections
 * @copyright 2022 Marina Glancy
 * @license   http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */
class content extends \core_courseformat\output\local\content {
    /** @var \format_flexsections the course format class */
    protected $format;

    /** @var bool Flexsections format has add section. */
    protected $hasaddsection = true;

    /**
     * Template name for this exporter
     *
     * @param \renderer_base $renderer
     * @return string
     */
    public function get_template_name(\renderer_base $renderer): string {
        // Mdlcode uses: template 'format_flexsections/local/content'.
        return 'format_flexsections/local/content';
    }

    /**
     * Export this data so it can be used as the context for a mustache template (core/inplace_editable).
     *
     * @param \renderer_base $output typically, the renderer that's calling this function
     * @return \stdClass data context for a mustache template
     */
    public function export_for_template(\renderer_base $output) {
        $hidetopsection = $this->format->get_course()->hidetopsection ?? 1;
        
        if ($hidetopsection) {
            $course = $this->format->get_course();
            $modinfo = get_fast_modinfo($course->id);
            if (!empty($modinfo->sections[0])) {
                foreach ($modinfo->sections[0] as $cmid) {
                    $cm = $modinfo->get_cm($cmid);
                    if ($cm->modname === 'forum') {
                        global $DB;
                        $forum = $DB->get_record('forum', ['id' => $cm->instance]);
                        if ($forum && $forum->type === 'news') {
                            $section1 = $this->format->get_section(1);
                            if (!$section1) {
                                $this->format->create_new_section(0, null);
                                $modinfo = get_fast_modinfo($course->id);
                                $section1 = $this->format->get_section(1);
                            }
                            if ($section1) {
                                $targetsection = $modinfo->get_section_info($section1->section);
                                moveto_module($cm, $targetsection);
                                // Modinfo changes after moveto_module, we must rebuild or let it be
                            }
                        }
                    }
                }
            }
        }

        $data = parent::export_for_template($output);

        // Moodle 4.0+ puts section 0 inside the 'sections' array.
        // We extract it so it renders strictly above the tabs, or discard it if hidden.
        if (!empty($data->sections)) {
            $first_section = reset($data->sections);
            if (isset($first_section->num) && $first_section->num == 0) {
                $section0 = array_shift($data->sections);
                if (!$hidetopsection && !$this->format->get_viewed_section()) {
                    $data->initialsection = $section0;
                }
            } else if (is_array($first_section) && isset($first_section['num']) && $first_section['num'] == 0) {
                $section0 = array_shift($data->sections);
                if (!$hidetopsection && !$this->format->get_viewed_section()) {
                    $data->initialsection = $section0;
                }
            }
        }

        if ($hidetopsection) {
            $data->initialsection = null;
        }

        // If we are on course view page for particular section.
        if ($this->format->get_viewed_section()) {
            // Do not display the "General" section when on a page of another section.
            $data->initialsection = null;

            // Add 'back to parent' control.
            $section = $this->format->get_section($this->format->get_viewed_section());
            if ($section->parent > 0) {
                $sr = $this->format->find_collapsed_parent($section->parent);
                $url = $this->format->get_view_url($section->section, ['sr' => $sr]);
                $data->backtosection = [
                    'url' => $url->out(false),
                    'sectionname' => $this->format->get_section_name($section->parent),
                ];
            } else {
                $sr = 0;
                $url = $this->format->get_view_url($section->section, ['sr' => $sr]);
                $context = \context_course::instance($this->format->get_courseid());
                $data->backtocourse = [
                    'url' => $url->out(false),
                    'coursename' => format_string($this->format->get_course()->fullname, true, ['context' => $context]),
                ];
            }

            // Hide add section link below page content.
            $data->numsections = false;
        }
        $data->accordion = $this->format->get_accordion_setting() ? 1 : '';
        $data->mainsection = $this->format->get_viewed_section();

        // ------------------ NEW TAB LOGIC ------------------
        if (!$this->format->get_viewed_section()) {
            $modinfo = get_fast_modinfo($this->format->get_course());
            $sections = $modinfo->get_section_info_all();
            $firsttab = true;
            
            $tab_nav = [];
            $tab_panes = [];
            
            foreach ($sections as $s) {
                if ($s->section > 0 && $s->parent == -1 && $this->format->is_section_visible($s)) {
                    $sectionoutput = new $this->sectionclass($this->format, $s);
                    $exported = $sectionoutput->export_for_template($output);
                    
                    $isactive = $firsttab ? true : false;
                    $firsttab = false;
                    
                    $tab_nav[] = [
                        'id' => $s->id,
                        'name' => $this->format->get_section_name($s),
                        'isactive' => $isactive,
                    ];
                    
                    $exported->istabpane = true;
                    $exported->isactive = $isactive;
                    $tab_panes[] = $exported;
                }
            }
            
            if (!empty($tab_nav)) {
                $data->hastabs = true;
                $data->tabnav = $tab_nav;
                $data->tabpanes = $tab_panes;
            }
        }
        // ---------------------------------------------------

        return $data;
    }

    /**
     * Return an array of sections to display.
     *
     * This method is used to differentiate between display a specific section
     * or a list of them.
     *
     * @param course_modinfo $modinfo the current course modinfo object
     * @return \section_info[] an array of section_info to display
     */
    protected function get_sections_to_display(course_modinfo $modinfo): array {
        $singlesectionid = $this->format->get_sectionid();
        if ($singlesectionid) {
            return [
                $modinfo->get_section_info_by_id($singlesectionid),
            ];
        }

        $viewedsection = $this->format->get_viewed_section();
        return array_values(array_filter($modinfo->get_section_info_all(), function ($s) use ($viewedsection) {
            if ($s->is_delegated()) {
                return false;
            }
            return (!$s->section) ||
                (!$viewedsection && !$s->parent && $this->format->is_section_visible($s)) ||
                ($viewedsection && $s->section == $viewedsection);
        }));
    }
}
