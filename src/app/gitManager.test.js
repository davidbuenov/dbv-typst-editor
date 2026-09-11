// =============================================================================
// DBV Typst Editor — Tests del gestor Git (RF-19)
// Copyright (c) 2026 David Bueno Vallejo
// Licensed under the MIT License. See LICENSE for details.
// Built with dbv-specs-ops · https://github.com/davidbuenov/dbv-specs-ops
// =============================================================================

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createGitManager } from './gitManager.js';
import * as backend from '../services/backend.js';

describe('gitManager', () => {
  let indicatorEl;
  let triggerBtn;
  let branchEl;
  let summaryEl;
  let panelEl;
  let popoverBranchEl;
  let popoverAbEl;
  let filesEl;
  let commitInputEl;
  let commitBtn;
  let pushBtn;
  let pullBtn;
  let notifications;

  beforeEach(() => {
    indicatorEl = document.createElement('div');
    indicatorEl.className = 'hidden';
    triggerBtn = document.createElement('button');
    branchEl = document.createElement('span');
    summaryEl = document.createElement('span');
    panelEl = document.createElement('div');
    panelEl.className = 'hidden';
    popoverBranchEl = document.createElement('span');
    popoverAbEl = document.createElement('span');
    filesEl = document.createElement('div');
    commitInputEl = document.createElement('input');
    commitBtn = document.createElement('button');
    pushBtn = document.createElement('button');
    pullBtn = document.createElement('button');
    notifications = [];
  });

  function setup(projectPath = '/mi/repo') {
    return createGitManager({
      indicatorEl,
      triggerBtn,
      branchEl,
      summaryEl,
      panelEl,
      popoverBranchEl,
      popoverAbEl,
      filesEl,
      commitInputEl,
      commitBtn,
      pushBtn,
      pullBtn,
      getProjectPath: () => projectPath,
      notify: (msg, tone) => notifications.push({ msg, tone }),
    });
  }

  it('hides indicator when there is no active project', async () => {
    const manager = setup(null);
    indicatorEl.classList.remove('hidden');

    await manager.refresh();

    expect(indicatorEl.classList.contains('hidden')).toBe(true);
  });

  it('hides indicator when directory is not a git repo', async () => {
    vi.spyOn(backend, 'gitStatus').mockResolvedValue({
      ok: true,
      value: {
        isRepo: false,
        branch: '',
        ahead: 0,
        behind: 0,
        modifiedFiles: [],
        untrackedFiles: [],
        conflictedFiles: [],
      },
    });

    const manager = setup();
    await manager.refresh();

    expect(indicatorEl.classList.contains('hidden')).toBe(true);
  });

  it('renders branch and files when directory is a git repo', async () => {
    vi.spyOn(backend, 'gitStatus').mockResolvedValue({
      ok: true,
      value: {
        isRepo: true,
        branch: 'main',
        ahead: 1,
        behind: 0,
        modifiedFiles: ['main.typ'],
        untrackedFiles: ['extra.typ'],
        conflictedFiles: [],
      },
    });

    const manager = setup();
    await manager.refresh();

    expect(indicatorEl.classList.contains('hidden')).toBe(false);
    expect(branchEl.textContent).toBe('main');
    expect(summaryEl.textContent).toContain('2');
    expect(summaryEl.textContent).toContain('↑1');

    const items = filesEl.querySelectorAll('.git-popover__file-item');
    expect(items.length).toBe(2);
  });

  it('handles commit flow with notification and input clear', async () => {
    const statusSpy = vi.spyOn(backend, 'gitStatus').mockResolvedValue({
      ok: true,
      value: {
        isRepo: true,
        branch: 'main',
        ahead: 0,
        behind: 0,
        modifiedFiles: ['doc.typ'],
        untrackedFiles: [],
        conflictedFiles: [],
      },
    });

    const commitSpy = vi.spyOn(backend, 'gitCommit').mockResolvedValue({
      ok: true,
      value: { success: true, message: '[main 1234567] Mi cambio' },
    });

    setup();
    commitInputEl.value = 'Mi cambio';
    commitBtn.click();

    await vi.waitFor(() => {
      expect(commitSpy).toHaveBeenCalledWith({
        projectPath: '/mi/repo',
        message: 'Mi cambio',
      });
    });

    expect(commitInputEl.value).toBe('');
    expect(notifications.length).toBe(1);
  });

  it('handles push button', async () => {
    const pushSpy = vi.spyOn(backend, 'gitPush').mockResolvedValue({
      ok: true,
      value: { success: true, message: 'Everything up-to-date' },
    });
    vi.spyOn(backend, 'gitStatus').mockResolvedValue({
      ok: true,
      value: {
        isRepo: true,
        branch: 'main',
        ahead: 0,
        behind: 0,
        modifiedFiles: [],
        untrackedFiles: [],
        conflictedFiles: [],
      },
    });

    setup();

    pushBtn.click();
    await vi.waitFor(() => expect(pushSpy).toHaveBeenCalledWith('/mi/repo'));
  });

  it('handles pull button', async () => {
    const pullSpy = vi.spyOn(backend, 'gitPull').mockResolvedValue({
      ok: true,
      value: { success: true, message: 'Already up to date.' },
    });
    vi.spyOn(backend, 'gitStatus').mockResolvedValue({
      ok: true,
      value: {
        isRepo: true,
        branch: 'main',
        ahead: 0,
        behind: 0,
        modifiedFiles: [],
        untrackedFiles: [],
        conflictedFiles: [],
      },
    });

    setup();

    pullBtn.click();
    await vi.waitFor(() => expect(pullSpy).toHaveBeenCalledWith('/mi/repo'));
  });

  it('turns the raw "would be overwritten by merge" git error into an actionable message', async () => {
    vi.spyOn(backend, 'gitPull').mockResolvedValue({
      ok: true,
      value: {
        success: false,
        message:
          'error: Your local changes to the following files would be overwritten by merge:\n\tmain.typ\nPlease commit your changes or stash them before you merge.\nAborting',
      },
    });
    vi.spyOn(backend, 'gitStatus').mockResolvedValue({
      ok: true,
      value: { isRepo: true, branch: 'main', ahead: 0, behind: 1, modifiedFiles: ['main.typ'], untrackedFiles: [], conflictedFiles: [] },
    });

    setup();
    pullBtn.click();

    await vi.waitFor(() => expect(notifications.length).toBe(1));
    expect(notifications[0].tone).toBe('error');
    expect(notifications[0].msg).not.toContain('would be overwritten');
    expect(notifications[0].msg.toLowerCase()).toContain('commit');
  });

  it('shows an unrecognized pull error as-is', async () => {
    vi.spyOn(backend, 'gitPull').mockResolvedValue({
      ok: true,
      value: { success: false, message: 'fatal: unable to access remote' },
    });
    vi.spyOn(backend, 'gitStatus').mockResolvedValue({
      ok: true,
      value: { isRepo: true, branch: 'main', ahead: 0, behind: 0, modifiedFiles: [], untrackedFiles: [], conflictedFiles: [] },
    });

    setup();
    pullBtn.click();

    await vi.waitFor(() => expect(notifications.length).toBe(1));
    expect(notifications[0].msg).toBe('fatal: unable to access remote');
  });

  it('shows a conflicted file with its own Resolve button, ahead of the regular list', async () => {
    vi.spyOn(backend, 'gitStatus').mockResolvedValue({
      ok: true,
      value: {
        isRepo: true,
        branch: 'main',
        ahead: 0,
        behind: 1,
        modifiedFiles: ['other.typ'],
        untrackedFiles: [],
        conflictedFiles: ['main.typ'],
      },
    });

    const resolved = [];
    const manager = createGitManager({
      indicatorEl,
      triggerBtn,
      branchEl,
      summaryEl,
      panelEl,
      popoverBranchEl,
      popoverAbEl,
      filesEl,
      commitInputEl,
      commitBtn,
      pushBtn,
      pullBtn,
      getProjectPath: () => '/mi/repo',
      notify: (msg, tone) => notifications.push({ msg, tone }),
      onResolveConflict: (path) => resolved.push(path),
    });

    await manager.refresh();

    const items = filesEl.querySelectorAll('.git-popover__file-item');
    expect(items.length).toBe(2);
    expect(items[0].classList.contains('git-popover__file-item--conflict')).toBe(true);
    expect(items[0].textContent).toContain('main.typ');

    items[0].querySelector('button').click();
    expect(resolved).toEqual(['main.typ']);
  });
});
