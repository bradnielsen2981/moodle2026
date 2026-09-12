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
        $data = parent::export_for_template($output);

        // Generate tabs for tabs (sections with istab=1)
        $modinfo = get_fast_modinfo($this->format->get_courseid());
        $pages = [];
        
        foreach ($modinfo->get_section_info_all() as $s) {
            if ($s->section > 0 && empty($s->parent) && !$s->is_delegated() && $this->format->is_section_visible($s)) {
                $formatoptions = course_get_format($this->format->get_courseid())->get_format_options($s);
                if (!empty($formatoptions['istab'])) {
                    $pages[] = $s;
                }
            }
        }
        
        $activetab = 0;
        $viewedsection = $this->format->get_viewed_section();
        if ($viewedsection) {
            $vs = $modinfo->get_section_info($viewedsection);
            while ($vs && $vs->section > 0) {
                if (empty($vs->parent)) {
                    $formatoptions = course_get_format($this->format->get_courseid())->get_format_options($vs);
                    if (!empty($formatoptions['istab'])) {
                        $activetab = $vs->section;
                    }
                    break;
                }
                $vs = $modinfo->get_section_info($vs->parent);
            }
        }

        $tabs = [];
        
        $tabs[] = [
            'id' => 0,
            'name' => format_string($this->format->get_course()->shortname),
            'url' => (new \moodle_url('/course/view.php', ['id' => $this->format->get_courseid()]))->out(false),
            'isactive' => ($activetab === 0),
            'section' => 0
        ];

        foreach ($pages as $p) {
            $url = new \moodle_url('/course/view.php', ['id' => $this->format->get_courseid(), 'section' => $p->section]);
            $isactive = ($activetab === $p->section);
            $tabs[] = [
                'id' => $p->id,
                'name' => get_section_name($this->format->get_courseid(), $p),
                'url' => $url->out(false),
                'isactive' => $isactive,
                'section' => $p->section
            ];
        }

        $showtabs = true;
        $data->tabs = $tabs;
        $data->showtabs = $showtabs;
        
        if ($this->format->show_editor() && $this->format->should_display_add_sub_section_link(0)) {
            $data->addpageurl = (new \moodle_url('/course/format/flexsections/addtab.php', ['courseid' => $this->format->get_courseid(), 'sesskey' => sesskey()]))->out(false);
        }

        // If we are on course view page for particular section.
        if ($this->format->get_viewed_section()) {
            // Do not display the "General" section when on a page of another section.
            $data->initialsection = null;

            // Add 'back to parent' control.
            $section = $this->format->get_section($this->format->get_viewed_section());
            if ($section->parent) {
                $sr = $this->format->find_collapsed_parent($section->parent);
                $url = $this->format->get_view_url($section->section, ['sr' => $sr]);
                $data->backtosection = [
                    'url' => $url->out(false),
                    'sectionname' => $this->format->get_section_name($section->parent),
                ];
            }

            // Hide add section link below page content.
            $data->numsections = false;
        }
        $data->accordion = $this->format->get_accordion_setting() ? 1 : '';
        $data->mainsection = $this->format->get_viewed_section();
        $data->numsections = false; // Hide add section link below page content, as we use the Add page tab.

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
        
        // Determine the active tab
        $activetab = 0;
        if ($viewedsection) {
            $vs = $modinfo->get_section_info($viewedsection);
            while ($vs && $vs->section > 0) {
                if (empty($vs->parent)) {
                    $formatoptions = course_get_format($this->format->get_courseid())->get_format_options($vs);
                    if (!empty($formatoptions['istab'])) {
                        $activetab = $vs->section;
                    }
                    break;
                }
                $vs = $modinfo->get_section_info($vs->parent);
            }
        }

        return array_values(array_filter($modinfo->get_section_info_all(), function ($s) use ($activetab) {
            if ($s->is_delegated()) {
                return false;
            }
            
            // If the section is the general section (section 0), display it.
            if (!$s->section) {
                return true;
            }
            
            // Display sections based on the active tab
            if ($activetab === 0) {
                // Main page: display all top-level sections that are NOT tabs.
                if (empty($s->parent)) {
                    $formatoptions = course_get_format($this->format->get_courseid())->get_format_options($s);
                    if (empty($formatoptions['istab'])) {
                        return true;
                    }
                }
                return false;
            } else {
                // Specific page: display ONLY the Page section itself.
                // The flexsections output classes will automatically render its subsections.
                if ($s->section == $activetab) {
                    return true;
                }
                return false;
            }
        }));
    }
}
