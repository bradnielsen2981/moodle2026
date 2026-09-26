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
 * Renders the Tabs UI for format_multipageformat.
 *
 * Tabs represent higher level sections: a Tab section groups other sections as its
 * children. This module builds a clickable tab strip from the Tab sections already
 * rendered on the page and shows/hides the relevant section boxes client-side.
 * Sections with no Tab relationship are left untouched and always stay visible.
 *
 * @module     format_multipageformat/tabs
 * @copyright  2026 Brad Nielsen
 * @license    http://www.gnu.org/copyleft/gpl.html GNU GPL v3 or later
 */

import {open as openAddPage} from 'format_multipageformat/addpage';
import Collapse from 'theme_boost/bootstrap/collapse';

const SELECTORS = {
    SECTIONLIST: '[data-for="course_sectionlist"]',
    SECTION: (id) => `li[data-for="section"][data-id="${id}"]`,
    SINGLESECTION: '.single-section ul.section-list > li[data-for="section"]',
    TABLINK: '[data-tabid]',
};

const CLASSES = {
    HIDDEN: 'd-none',
    INDEXCHILD: 'format-multipageformat-index-child',
    INDEXCOLLAPSED: 'format-multipageformat-index-collapsed',
    INDEXFOCUSED: 'format-multipageformat-index-focused',
};

/**
 * Resolve the tab definitions (from PHP) into their DOM elements.
 *
 * @param {Element} sectionList the section list container
 * @param {Array} tabs array of {sectionid, childsectionids}
 * @return {Array} resolved tabs, each with {sectionid, name, groupEls}
 */
const resolveTabs = (sectionList, tabs) => {
    return tabs.map(tab => {
        // Normalise to Number: dataset attributes are always strings, and we
        // must not rely on the PHP layer returning ints rather than numeric strings.
        const sectionid = Number(tab.sectionid);
        const tabEl = sectionList.querySelector(SELECTORS.SECTION(sectionid));
        if (!tabEl) {
            // The Tab section is not visible on this page (e.g. viewing a single
            // section), nothing to render for it.
            return null;
        }
        const childEls = tab.childsectionids
            .map(id => sectionList.querySelector(SELECTORS.SECTION(Number(id))))
            .filter(el => el !== null);

        // Mark the Tab and its children in the DOM so other components (e.g. the section
        // drag and drop validation) can tell a Tab relationship apart without needing their
        // own copy of this data - a Tab must stay above all of its own children at all times.
        tabEl.dataset.tabSection = 'true';
        tabEl.dataset.tabChildren = childEls.map(el => el.dataset.id).join(',');
        childEls.forEach(el => {
            el.dataset.tabParent = String(sectionid);
        });

        return {
            sectionid,
            name: tabEl.dataset.sectionname,
            groupEls: [tabEl, ...childEls],
        };
    }).filter(tab => tab !== null);
};

/**
 * Arrange the sections of each page under that page in the Course index drawer.
 *
 * The Course index lists every section in one flat list. The sections that belong to a page
 * are marked so they can be indented under the page (see styles.css), and they are only
 * shown while their page is expanded in the index, like the subsections inside a section.
 * A page's own subsections are nested in the page by core already.
 *
 * This works directly off the raw Tab data from PHP against the Course index's own DOM,
 * deliberately not the main content's section list: the Course index always lists every
 * section regardless of which page is loaded (see format_multipageformat\output\courseformat\
 * state\course, which is core's, unfiltered), but the main content does not - visiting a
 * single section's own page (a Tab, or any of its real delegated subsections) only renders
 * that one section there. Keying this off the main content would leave every other page's
 * grouping undone whenever that happens.
 *
 * @param {Array} tabs array of {sectionid, childsectionids} as passed to init()
 */
const syncCourseIndex = (tabs) => {
    const index = document.querySelector('.courseindex');
    if (!index) {
        return;
    }
    const indexSection = (id) => index.querySelector(`.courseindex-section[data-id="${id}"]:not(.delegated-section)`);
    tabs.forEach(tab => {
        const tabEl = indexSection(tab.sectionid);
        if (!tabEl) {
            return;
        }
        const chevron = tabEl.querySelector(':scope > .courseindex-section-title .courseindex-chevron');
        const expanded = chevron?.getAttribute('aria-expanded') === 'true';
        tab.childsectionids.forEach(childid => {
            const childEl = indexSection(childid);
            if (childEl) {
                childEl.classList.add(CLASSES.INDEXCHILD);
                childEl.classList.toggle(CLASSES.INDEXCOLLAPSED, !expanded);
            }
        });
    });
};

/**
 * Build the tab strip DOM (a nav-tabs list wrapped in a single <li> so it stays
 * valid inside the section <ul>).
 *
 * @param {Array} resolvedTabs resolved tabs from resolveTabs()
 * @param {Function} onSelect callback invoked with the sectionid of the clicked tab
 * @param {string} addPageLabel label of the trailing "Add page" tab, or empty for none
 * @return {Element} the wrapper <li> ready to be inserted into the section list
 */
const buildTabStrip = (resolvedTabs, onSelect, addPageLabel) => {
    const wrapper = document.createElement('li');
    wrapper.className = 'format-multipageformat-tabs-wrapper';
    wrapper.style.listStyle = 'none';

    // Core's section-list reordering (see the observer set up in init()) removes any
    // list item it does not recognise as a section unless it is flagged as an orphan,
    // in which case it is preserved (moved to the end of the list instead of deleted).
    wrapper.dataset.orphan = 'true';

    const nav = document.createElement('ul');
    nav.className = 'nav nav-tabs format-multipageformat-tabs mb-3';
    nav.setAttribute('role', 'tablist');

    resolvedTabs.forEach(tab => {
        const item = document.createElement('li');
        item.className = 'nav-item';
        item.setAttribute('role', 'presentation');

        const link = document.createElement('a');
        link.href = '#';
        link.className = 'nav-link';
        link.dataset.tabid = tab.sectionid;
        link.setAttribute('role', 'tab');
        link.textContent = tab.name;
        link.addEventListener('click', (event) => {
            event.preventDefault();
            onSelect(tab.sectionid);
        });

        item.appendChild(link);
        nav.appendChild(item);
    });

    if (addPageLabel) {
        // A trailing tab that creates a new page. It has no data-tabid, so it is never treated
        // as one of the pages.
        const item = document.createElement('li');
        item.className = 'nav-item';
        item.setAttribute('role', 'presentation');

        const link = document.createElement('a');
        link.href = '#';
        link.className = 'nav-link format-multipageformat-addpage';
        const icon = document.createElement('i');
        icon.className = 'icon fa fa-plus fa-fw';
        icon.setAttribute('aria-hidden', 'true');
        link.append(icon, addPageLabel);
        link.addEventListener('click', (event) => {
            event.preventDefault();
            openAddPage();
        });

        item.appendChild(link);
        nav.appendChild(item);
    }

    wrapper.appendChild(nav);
    return wrapper;
};

/**
 * Build the sessionStorage key used to remember the active tab for a course.
 *
 * A plain edit action (making a page, attaching or detaching a subsection, ...) reloads
 * the whole page to pick up the new tab layout, which would otherwise always reset the
 * view back to the first tab. sessionStorage survives that reload (it is only cleared
 * when the browser tab itself closes), so the active tab can be restored afterwards.
 *
 * @param {number} courseId the course id
 * @return {string} the storage key
 */
const storageKey = (courseId) => `format_multipageformat/activetab/${courseId}`;

/**
 * Find the id of the section actually on screen, whichever kind of page this is.
 *
 * @return {?number} the section id, or null if none can be determined
 */
const getFocusSectionId = () => {
    // A Tab's own page, or one of its real delegated subsections: that page shows exactly
    // one top-level section, which is the one in view.
    const singleSection = document.querySelector(SELECTORS.SINGLESECTION);
    if (singleSection) {
        return Number(singleSection.dataset.id);
    }
    // The full course page: whichever section the URL anchor points at, if any.
    const match = window.location.hash.match(/^#section-(\d+)$/);
    const target = match ? document.getElementById(`section-${match[1]}`) : null;
    return target ? Number(target.dataset.id) : null;
};

/**
 * Whether a section id is a given Tab itself, or one of its plain (tabs_manager) children.
 *
 * @param {Array} tabs array of {sectionid, childsectionids} as passed to init()
 * @param {number} id the section id to check
 * @return {?Object} the owning tab ({sectionid, childsectionids}), or undefined if none found
 */
const tabOwning = (tabs, id) => tabs.find(
    (tab) => tab.sectionid === id || tab.childsectionids.some((childid) => Number(childid) === id)
);

/**
 * Find which Tab owns a section.
 *
 * The section can be a Tab itself, one of its plain (tabs_manager) children, or - one level
 * further in - a real delegated subsection nested inside either of those. In that last case
 * there is no data for it in `tabs`, so this walks up the actual DOM nesting instead, from
 * the subsection to the plain section it lives in, until it reaches one `tabs` does know
 * about (or runs out of ancestors, for a section with no Tab relationship at all).
 *
 * @param {Array} tabs array of {sectionid, childsectionids} as passed to init()
 * @param {number} focusId the section id to resolve
 * @return {?Object} the owning tab ({sectionid, childsectionids}), or null if none found
 */
const findOwningTab = (tabs, focusId) => {
    let currentId = focusId;
    const seen = new Set();
    while (currentId !== null && !seen.has(currentId)) {
        seen.add(currentId);
        const owningTab = tabOwning(tabs, currentId);
        if (owningTab) {
            return owningTab;
        }
        const sectionEl = document.querySelector(`[data-for="section"][data-id="${currentId}"]`);
        const parentEl = sectionEl?.parentElement?.closest('[data-for="section"]');
        currentId = parentEl ? Number(parentEl.dataset.id) : null;
    }
    return null;
};

/**
 * Expand or collapse a Tab's own node in the Course index, directly through Bootstrap.
 *
 * This mirrors core's own courseindex.js _expandSectionNode: a plain DOM/Bootstrap-Collapse
 * operation, not a reactive state mutation. core uses that same direct approach for the one
 * other case where it auto-reveals a section to match what's on screen (see its
 * _expandPageCmSectionIfNecessary) rather than dispatching sectionIndexCollapsed, because
 * that mutation is only safe once the Course index component has registered its watchers -
 * timing this module has no reliable way to know from the outside.
 *
 * @param {number} tabSectionId the Tab's section id
 * @param {boolean} expand true to expand it, false to collapse it
 */
const setTabExpandedInIndex = (tabSectionId, expand) => {
    const toggler = document
        .querySelector(`.courseindex .courseindex-section[data-id="${tabSectionId}"]:not(.delegated-section)`)
        ?.querySelector(':scope > .courseindex-section-title .courseindex-chevron');
    let collapsibleId = toggler?.dataset.target ?? toggler?.getAttribute('href');
    if (!collapsibleId) {
        return;
    }
    const collapsible = document.getElementById(collapsibleId.replace('#', ''));
    if (!collapsible) {
        return;
    }
    Collapse.getOrCreateInstance(collapsible, {toggle: false})[expand ? 'show' : 'hide']();
};

/**
 * The Course index item currently marked as the one on screen, so it can be un-marked
 * once a different one takes over.
 */
let focusedIndexEl = null;

/**
 * Highlight whichever Course index item corresponds to the section actually on screen, so the
 * drawer shows what was just clicked - whether that click was a Course index link itself, or a
 * section/subsection heading link within the page (both change the URL the same way).
 *
 * This is deliberately not core's own "current" class: that one reflects the course's marker
 * (the "Highlight" action on a topic) and has nothing to do with what is currently being viewed.
 *
 * @param {?number} focusId the section id actually on screen, or null for none
 */
const highlightFocusedSection = (focusId) => {
    if (focusedIndexEl) {
        focusedIndexEl.classList.remove(CLASSES.INDEXFOCUSED);
        focusedIndexEl = null;
    }
    if (!focusId) {
        return;
    }
    const el = document.querySelector(`.courseindex .courseindex-section[data-id="${focusId}"]`);
    if (el) {
        el.classList.add(CLASSES.INDEXFOCUSED);
        focusedIndexEl = el;
    }
};

/**
 * Show only the path to the section actually on screen in the Course index: expand its Tab
 * and collapse every other one, so the drawer always reflects where you are instead of
 * whatever was left expanded from earlier browsing. Also highlights the exact section or
 * subsection on screen (see highlightFocusedSection).
 *
 * @param {Array} tabs array of {sectionid, childsectionids} as passed to init()
 */
const expandCurrentPathInIndex = (tabs) => {
    const focusId = getFocusSectionId();
    highlightFocusedSection(focusId);
    if (!focusId) {
        return;
    }
    const owningTab = findOwningTab(tabs, focusId);
    if (!owningTab) {
        return;
    }
    tabs.forEach((tab) => setTabExpandedInIndex(tab.sectionid, tab.sectionid === owningTab.sectionid));
};

/**
 * Initialise the Tabs UI.
 *
 * @param {Array} tabs array of {sectionid: number, childsectionids: number[]} as built
 *     by format_multipageformat\output\courseformat\content::export_tabs()
 * @param {number} courseId the course id, used to remember the active tab across reloads
 * @param {string} addPageLabel label of the "Add page" tab (edit mode only), empty for none
 */
export const init = (tabs, courseId, addPageLabel = '') => {
    if (!tabs || !tabs.length) {
        return;
    }

    // Keep the Course index grouped by page on every page, including pages where the main
    // content only ever shows a single section (a Tab's own page, or one of its real delegated
    // subsections) and so has nothing for the code below to build a Tab strip out of.
    syncCourseIndex(tabs);
    const courseindex = document.querySelector('.courseindex');
    if (courseindex) {
        let pending = false;
        new MutationObserver(() => {
            if (!pending) {
                pending = true;
                requestAnimationFrame(() => {
                    pending = false;
                    syncCourseIndex(tabs);
                });
            }
        }).observe(courseindex, {
            subtree: true,
            childList: true,
            attributes: true,
            attributeFilter: ['aria-expanded', 'class'],
        });
    }

    expandCurrentPathInIndex(tabs);
    window.addEventListener('hashchange', () => expandCurrentPathInIndex(tabs));

    // Everything from here on builds the Tab strip and switches between tab groups in the
    // main content, which only makes sense when this page actually renders more than one
    // section for it to switch between.
    const sectionList = document.querySelector(SELECTORS.SECTIONLIST);
    if (!sectionList) {
        return;
    }

    let resolvedTabs = resolveTabs(sectionList, tabs);
    if (!resolvedTabs.length) {
        return;
    }

    const key = storageKey(courseId);
    const rememberActive = (sectionId) => {
        try {
            sessionStorage.setItem(key, sectionId);
        } catch (e) {
            // Private browsing or storage disabled - the tab just won't be remembered.
            return;
        }
    };
    const getRememberedActive = () => {
        try {
            const stored = Number(sessionStorage.getItem(key));
            return resolvedTabs.some(tab => tab.sectionid === stored) ? stored : null;
        } catch (e) {
            return null;
        }
    };

    let activeSectionId = getRememberedActive() ?? resolvedTabs[0].sectionid;
    let strip = null;

    const setActive = (sectionId) => {
        activeSectionId = sectionId;
        rememberActive(sectionId);
        resolvedTabs.forEach(tab => {
            const isActive = tab.sectionid === activeSectionId;
            tab.groupEls.forEach(el => el.classList.toggle(CLASSES.HIDDEN, !isActive));
        });
        strip.querySelectorAll(SELECTORS.TABLINK).forEach(link => {
            const isActive = Number(link.dataset.tabid) === activeSectionId;
            link.classList.toggle('active', isActive);
            link.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
    };

    strip = buildTabStrip(resolvedTabs, setActive, addPageLabel);

    // The strip belongs right before the first tabbed section so untabbed sections
    // keep rendering above it, undisturbed.
    const reposition = () => {
        const anchor = resolvedTabs[0]?.groupEls[0];
        if (anchor && strip.nextElementSibling !== anchor) {
            sectionList.insertBefore(strip, anchor);
        }
    };

    // Drop any tab whose own section has been deleted. Its content is gone with it
    // (it lived in the Tab section's own activities), so there is nothing left to
    // show for it - remove its nav-link too instead of leaving a dead button behind.
    const pruneDeletedTabs = () => {
        let activeWasRemoved = false;
        resolvedTabs = resolvedTabs.filter(tab => {
            if (sectionList.contains(tab.groupEls[0])) {
                return true;
            }
            strip.querySelector(`[data-tabid="${tab.sectionid}"]`)?.closest('li')?.remove();
            activeWasRemoved = activeWasRemoved || (tab.sectionid === activeSectionId);
            return false;
        });

        if (!resolvedTabs.length) {
            strip.remove();
            return;
        }
        if (activeWasRemoved) {
            setActive(resolvedTabs[0].sectionid);
        }
    };

    // Reordering sections (e.g. dragging one above another) makes core rebuild the
    // section list to match the new state order. It does not know about this strip,
    // so it gets pushed out and re-appended at the very end of the list instead of
    // being deleted (see the 'orphan' flag above) - put it back where it belongs.
    // Deleting a section runs through the same rebuild, so this also catches Tabs
    // that just got deleted.
    const sync = () => {
        if (!strip.isConnected) {
            return;
        }
        pruneDeletedTabs();
        reposition();
    };

    // If the URL already points at a section (e.g. the Course index link that brought us here,
    // or a browser back/forward through history), that section's tab takes priority over the
    // remembered one, and the section is scrolled into view once its tab is visible.
    const focusSectionFromHash = () => {
        const match = window.location.hash.match(/^#section-(\d+)$/);
        if (!match) {
            return;
        }
        const target = document.getElementById(`section-${match[1]}`);
        if (!target) {
            return;
        }
        const targetId = Number(target.dataset.id);
        const owningTab = findOwningTab(tabs, targetId);
        const tab = owningTab ? resolvedTabs.find(t => t.sectionid === owningTab.sectionid) : null;
        if (tab && tab.sectionid !== activeSectionId) {
            setActive(tab.sectionid);
        }
        target.scrollIntoView({block: 'start'});
    };

    reposition();
    setActive(activeSectionId);
    focusSectionFromHash();

    // The Course index link is a plain in-page anchor when it targets the currently loaded
    // page, so the browser only fires 'hashchange' for it (no navigation/reload happens).
    window.addEventListener('hashchange', focusSectionFromHash);

    const observer = new MutationObserver(sync);
    observer.observe(sectionList, {childList: true});

    // Renaming a section is a separate inplace_editable component nested inside the
    // section header, so it does not go through the section-list mutations above.
    // Keep the tab's nav-link (and its cached name) in sync when a Tab gets renamed.
    sectionList.addEventListener('core/inplace_editable:updated', (event) => {
        const target = event.target;
        const itemtype = target?.dataset?.itemtype;
        if (
            target?.dataset?.component !== 'format_multipageformat'
            || (itemtype !== 'sectionname' && itemtype !== 'sectionnamenl')
        ) {
            return;
        }

        const sectionid = Number(target.dataset.itemid);
        const tab = resolvedTabs.find(t => t.sectionid === sectionid);
        if (!tab) {
            return;
        }

        const newname = target.dataset.value;
        tab.name = newname;
        tab.groupEls[0].dataset.sectionname = newname;
        const link = strip.querySelector(`[data-tabid="${tab.sectionid}"]`);
        if (link) {
            link.textContent = newname;
        }
    });
};
