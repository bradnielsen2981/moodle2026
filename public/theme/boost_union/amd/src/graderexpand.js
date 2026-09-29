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
 * Theme Boost Union - JS code for the expanded view of the grader report.
 *
 * The expanded view shows the grader table in a panel which fills the window below the navbar and scrolls in both
 * directions. The panel is created with CSS only (see the "Grader report" section in scss/boost_union/post.scss),
 * so the table stays inside the quick grading form and "Save changes" keeps working.
 *
 * @module     theme_boost_union/graderexpand
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

const SELECTORS = {
    TOGGLE: '[data-action="theme-boost-union-grader-expand"]',
    COLLAPSE: '[data-action="theme-boost-union-grader-collapse"]',
    BAR: '[data-region="theme-boost-union-grader-expandedbar"]',
    BARPERPAGE: '[data-region="theme-boost-union-grader-expandedbar-perpage"]',
    PERPAGE: '[data-region="theme-boost-union-grader-perpage"]',
    PERPAGELABEL: 'label:has(select[name="perpage"])',
    OPENPOPUP: '.modal.show, .dropdown-menu.show',
    TOPLEFTCELL: '.gradeparent th.topleft',
};

const EXPANDEDCLASS = 'theme-boost-union-grader-expanded';
const STORAGEKEY = 'theme_boost_union_grader_expanded';

let initialized = false;

/**
 * Remember the state of the expanded view for this browser, so it persists across paging and saving.
 *
 * @param {boolean} expanded
 */
const storeState = (expanded) => {
    try {
        window.localStorage.setItem(STORAGEKEY, expanded ? '1' : '0');
    } catch (e) {
        // Storage is not available, the view just won't be remembered.
    }
};

/**
 * Get the remembered state of the expanded view.
 *
 * @returns {boolean}
 */
const getStoredState = () => {
    try {
        return window.localStorage.getItem(STORAGEKEY) === '1';
    } catch (e) {
        return false;
    }
};

/**
 * Check if the expanded view is shown.
 *
 * @returns {boolean}
 */
const isExpanded = () => document.body.classList.contains(EXPANDEDCLASS);

/**
 * Show or hide the expanded view.
 *
 * @param {boolean} expanded
 * @param {boolean} moveFocus Whether to move the focus to the close / toggle button.
 */
const setExpanded = (expanded, moveFocus) => {
    const toggle = document.querySelector(SELECTORS.TOGGLE);
    const bar = document.querySelector(SELECTORS.BAR);

    document.body.classList.toggle(EXPANDEDCLASS, expanded);
    bar.hidden = !expanded;
    toggle.setAttribute('aria-pressed', expanded ? 'true' : 'false');
    const label = expanded ? toggle.dataset.labelCollapse : toggle.dataset.labelExpand;
    toggle.setAttribute('title', label);
    toggle.setAttribute('aria-label', label);

    // Move the students per page selector into the header bar of the expanded view and back.
    const perpage = document.querySelector(SELECTORS.PERPAGELABEL);
    const perpageTarget = document.querySelector(expanded ? SELECTORS.BARPERPAGE : SELECTORS.PERPAGE);
    if (perpage && perpageTarget) {
        perpageTarget.appendChild(perpage);
    }

    storeState(expanded);

    if (moveFocus) {
        (expanded ? bar.querySelector(SELECTORS.COLLAPSE) : toggle).focus();
    }
};

/**
 * Initialise the expanded view.
 */
export const init = () => {
    const toggle = document.querySelector(SELECTORS.TOGGLE);
    if (initialized || !toggle || !document.querySelector('.gradeparent')) {
        return;
    }
    initialized = true;

    // Place the toggle in the top left cell of the grader table, above the name column.
    const topleft = document.querySelector(SELECTORS.TOPLEFTCELL);
    if (topleft) {
        topleft.appendChild(toggle);
    }
    toggle.classList.remove('d-none');

    toggle.addEventListener('click', () => setExpanded(!isExpanded(), true));
    document.querySelector(SELECTORS.COLLAPSE).addEventListener('click', () => setExpanded(false, true));

    // Close the expanded view with Escape, unless a dropdown or modal is open, which Escape should close first.
    // Listen in the capture phase, before these popups handle Escape and close themselves.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isExpanded() && !document.querySelector(SELECTORS.OPENPOPUP)) {
            setExpanded(false, true);
        }
    }, true);

    if (getStoredState()) {
        setExpanded(true, false);
    }
};
