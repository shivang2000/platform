<script lang="ts">
  import { RegionInfo } from '@hcengineering/account-client'
  import {
    groupByArray,
    isActiveMode,
    isArchivingMode,
    isDeletingMode,
    isMigrationMode,
    isRestoringMode,
    isUpgradingMode,
    reduceCalls,
    versionToString,
    type WorkspaceInfoWithStatus
  } from '@hcengineering/core'
  import { getEmbeddedLabel } from '@hcengineering/platform'
  import { copyTextToClipboard, isAdminUser, MessageBox } from '@hcengineering/presentation'
  import {
    Button,
    ButtonMenu,
    CheckBox,
    Expandable,
    IconArrowRight,
    IconCopy,
    IconDownOutline,
    IconOpen,
    IconStart,
    IconStop,
    locationToUrl,
    Popup,
    Scroller,
    SearchEdit,
    showPopup,
    ticker
  } from '@hcengineering/ui'
  import { workbenchId } from '@hcengineering/workbench'
  import { getAllWorkspaces, getRegionInfo, performWorkspaceOperation } from '../utils'

  $: now = $ticker

  $: isAdmin = isAdminUser()

  let search: string = ''

  async function select (workspace: string): Promise<void> {
    const url = locationToUrl({ path: [workbenchId, workspace] })
    window.open(url, '_blank')
  }

  type WorkspaceInfo = WorkspaceInfoWithStatus & { processingAttempts: number }

  let workspaces: WorkspaceInfo[] = []

  enum SortingRule {
    Name = '1',
    BackupDate = '2',
    BackupSize = '3',
    LastVisit = '4'
  }

  let sortingRule = SortingRule.BackupDate

  const sortRules = {
    [SortingRule.Name]: 'Name',
    [SortingRule.BackupDate]: 'Backup date',
    [SortingRule.BackupSize]: 'Backup size',
    [SortingRule.LastVisit]: 'Last visit'
  }

  const updateWorkspaces = reduceCalls(async (_: number) => {
    const res = await getAllWorkspaces()
    workspaces = res as WorkspaceInfo[]
  })

  $: void updateWorkspaces($ticker)

  // Individual filters

  let showActive: boolean = true
  let showArchived: boolean = false
  let showDeleted: boolean = false
  let showOther: boolean = true
  let showGrAttempts: boolean = true
  let showSelectedRegionOnly: boolean = false

  $: sortedWorkspaces = workspaces
    .filter(
      (it) =>
        ((it.name?.includes(search) ?? false) ||
          (it.url?.includes(search) ?? false) ||
          it.uuid?.includes(search) ||
          it.createdBy?.includes(search)) &&
        (showSelectedRegionOnly ? it.region === selectedRegionId : true) &&
        ((showActive && isActiveMode(it.mode)) ||
          (showArchived && isArchivingMode(it.mode)) ||
          (showDeleted && isDeletingMode(it.mode)) ||
          (showOther &&
            (isMigrationMode(it.mode) ||
              isRestoringMode(it.mode) ||
              isUpgradingMode(it.mode) ||
              (isArchivingMode(it.mode) && it.mode !== 'archived'))) ||
          (showGrAttempts && it.processingAttempts > 0))
    )
    .sort((a, b) => {
      switch (sortingRule) {
        case SortingRule.BackupDate: {
          return (a.backupInfo?.lastBackup ?? 0) - (b.backupInfo?.lastBackup ?? 0)
        }
        case SortingRule.BackupSize:
          return (b.backupInfo?.backupSize ?? 0) - (a.backupInfo?.backupSize ?? 0)
        case SortingRule.LastVisit:
          return (b.lastVisit ?? 0) - (a.lastVisit ?? 0)
      }
      return (b.url ?? b.uuid).localeCompare(a.url ?? a.uuid)
    })

  let backupIdx = new Map<string, number>()

  const backupInterval: number = 43200

  let backupable: WorkspaceInfo[] = []

  $: {
    // Assign backup idx
    const backupSorting = [...workspaces].filter((it) => {
      if (!isActiveMode(it.mode)) {
        return false
      }
      const lastBackup = it.backupInfo?.lastBackup ?? 0
      if ((now - lastBackup) / 1000 < backupInterval) {
        // No backup required, interval not elapsed
        return false
      }

      const createdOn = Math.floor((now - it.createdOn) / 1000)
      if (createdOn <= 2) {
        // Skip if we created is less 2 days
        return false
      }
      if (it.lastVisit == null) {
        return false
      }

      const lastVisitSec = Math.floor((now - it.lastVisit) / 1000)
      if (lastVisitSec > backupInterval) {
        // No backup required, interval not elapsed
        return false
      }
      return true
    })
    const newBackupIdx = new Map<string, number>()

    backupSorting.sort((a, b) => {
      return (a.backupInfo?.lastBackup ?? 0) - (b.backupInfo?.lastBackup ?? 0)
    })

    // Shift new with existing ones.
    const existingNew = groupByArray(backupSorting, (it) => it.backupInfo != null)

    const existing = existingNew.get(true) ?? []
    const newOnes = existingNew.get(false) ?? []
    const mixedBackupSorting: WorkspaceInfo[] = []

    while (existing.length > 0 || newOnes.length > 0) {
      const e = existing.shift()
      const n = newOnes.shift()
      if (e != null) {
        mixedBackupSorting.push(e)
      }
      if (n != null) {
        mixedBackupSorting.push(n)
      }
    }

    backupable = mixedBackupSorting

    for (const [idx, it] of mixedBackupSorting.entries()) {
      newBackupIdx.set(it.uuid, idx)
    }
    backupIdx = newBackupIdx
  }

  const dayRanges = {
    Today: [-1, 1],
    Week: [1, 7],
    Weeks: [7, 14],
    Month: [14, 30],
    Months1: [30, 60],
    Months2: [60, 90],
    Months3: [90, 180],
    'Six Month': [180, 270],
    'Nine Months': [270, 365],
    Years: [365, 10000000]
  }

  let limit = 50

  $: groupped = groupByArray(sortedWorkspaces, (it) => {
    const lastUsageDays = Math.round((now - (it.lastVisit ?? 0)) / (1000 * 3600 * 24))
    return Object.entries(dayRanges).find(([_k, v]) => v[0] < lastUsageDays && lastUsageDays < v[1])?.[0] ?? 'Other'
  })

  let regionInfo: RegionInfo[] = []

  let regionTitles: Record<string, string> = {}

  let selectedRegionId: string = ''
  void getRegionInfo().then((_regionInfo) => {
    regionInfo = _regionInfo ?? []
    regionTitles = Object.fromEntries(
      regionInfo.map((it) => [it.region, it.name.length !== 0 ? it.name : it.region.length > 0 ? it.region : 'Default'])
    )
    if (selectedRegionId === '' && regionInfo.length > 0) {
      selectedRegionId = regionInfo[0].region
    }
  })

  $: selectedRegionRef = regionInfo.find((it) => it.region === selectedRegionId)
  $: selectedRegionName =
    selectedRegionRef !== undefined
      ? selectedRegionRef.name.length > 0
        ? selectedRegionRef.name
        : selectedRegionRef.region
      : ''

  $: byVersion = groupByArray(
    workspaces.filter((it) => {
      const lastUsed = Math.round((now - (it.lastVisit ?? 0)) / (1000 * 3600 * 24))
      return isActiveMode(it.mode) && lastUsed < 1
    }),
    (it) => versionToString({ major: it.versionMajor, minor: it.versionMinor, patch: it.versionPatch })
  )

  $: byRegion = groupByArray(
    workspaces.filter((it) => isActiveMode(it.mode)),
    (it) => regionTitles[it.region ?? '']
  )

  let superAdminMode = false
</script>

<!-- svelte-ignore a11y-no-static-element-interactions -->
{#if isAdmin}
  <div class="anticrm-panel flex-row flex-grow p-5" style:overflow-y={'auto'}>
    <div class="flex-between">
      <div class="fs-title p-3">Workspaces administration panel</div>
      <div>
        <CheckBox bind:checked={superAdminMode} />
      </div>
    </div>
    <div class="fs-title p-3">
      Workspaces: {workspaces.length} active: {workspaces.filter((it) => isActiveMode(it.mode)).length}

      upgrading: {workspaces.filter((it) => isUpgradingMode(it.mode)).length}

      Backupable: {backupable.length} new: {backupable.reduce((p, it) => p + (it.backupInfo == null ? 1 : 0), 0)}

      <div class="flex-row-center">
        {#each byVersion.entries() as [k, v]}
          <div class="p-1">
            {k}: {v.length}
          </div>
        {/each}
      </div>
      <div class="flex-row-center">
        {#each byRegion.entries() as [k, v]}
          <div class="p-1">
            {k ?? ''}: {v.length}
          </div>
        {/each}
      </div>
    </div>
    <div class="fs-title p-3 flex-no-shrink">
      <SearchEdit bind:value={search} width={'100%'} />
    </div>

    <div class="p-3 flex-col">
      <span class="fs-title mr-2">Filters: </span>
      <div class="flex-row-center">
        Show active workspaces:
        <CheckBox bind:checked={showActive} />
      </div>
      <div class="flex-row-center">
        <span class="mr-2">Show archived workspaces:</span>
        <CheckBox bind:checked={showArchived} />
      </div>
      <div class="flex-row-center">
        <span class="mr-2">Show deleted workspaces:</span>
        <CheckBox bind:checked={showDeleted} />
      </div>
      <div class="flex-row-center">
        <span class="mr-2">Show other workspaces:</span>
        <CheckBox bind:checked={showOther} />
      </div>
      <div class="flex-row-center">
        <span class="mr-2">Show attempts >=0 workspaces:</span>
        <CheckBox bind:checked={showGrAttempts} />
      </div>
      <div class="flex-row-center">
        <span class="mr-2">Show selected region only:</span>
        <CheckBox bind:checked={showSelectedRegionOnly} />
      </div>
    </div>

    <div class="fs-title p-3 flex-row-center">
      <span class="mr-2"> Sorting order: {sortingRule} </span>
      <ButtonMenu
        selected={sortingRule}
        autoSelectionIfOne
        title={sortRules[sortingRule]}
        items={Object.entries(sortRules).map((it) => ({ id: it[0], label: getEmbeddedLabel(it[1]) }))}
        on:selected={(it) => {
          sortingRule = it.detail
        }}
      />
    </div>

    <div class="fs-title p-3 flex-row-center">
      <span class="mr-2"> Migration region selector: </span>
      <ButtonMenu
        selected={selectedRegionId}
        autoSelectionIfOne
        title={selectedRegionName}
        items={regionInfo.map((it) => ({
          id: it.region === '' ? '#' : it.region,
          label: getEmbeddedLabel(it.name.length > 0 ? it.name : it.region + ' (hidden)')
        }))}
        on:selected={(it) => {
          selectedRegionId = it.detail === '#' ? '' : it.detail
        }}
      />
    </div>
    <div class="fs-title p-1">
      <Scroller maxHeight={40} noStretch={true}>
        <div class="mr-4">
          {#each Object.keys(dayRanges) as k}
            {@const v = groupped.get(k) ?? []}
            {@const hasMore = (groupped.get(k) ?? []).length > limit}
            {@const activeV = v.filter((it) => isActiveMode(it.mode) && it.region !== selectedRegionId)}
            {@const activeAll = v.filter((it) => isActiveMode(it.mode))}
            {@const archivedV = v.filter((it) => isArchivingMode(it.mode))}
            {@const deletedV = v.filter((it) => isDeletingMode(it.mode))}
            {@const maintenance = v.length - activeAll.length - archivedV.length - deletedV.length}
            {@const grByRegion = groupByArray(v, (it) => regionTitles[it.region ?? ''])}
            {#if v.length > 0}
              <Expandable expandable={true} bordered={true} expanded={search.trim().length > 0}>
                <svelte:fragment slot="title">
                  <span class="fs-title focused-button flex-row-center">
                    {k} -
                    {#if hasMore}
                      {limit} of {v.length}
                    {:else}
                      {v.length}
                    {/if}
                    {#if maintenance > 0}
                      - maitenance: {maintenance}
                    {/if}
                    {#if grByRegion.size > 1}
                      {#each grByRegion.entries() as [k, v]}
                        <div class="p-1">
                          {k ?? ''}: {v.length}
                        </div>
                      {/each}
                    {/if}
                  </span>
                </svelte:fragment>
                <svelte:fragment slot="title-tools">
                  {#if hasMore}
                    <div class="ml-4">
                      <Button
                        label={getEmbeddedLabel('More items')}
                        kind={'link'}
                        on:click={() => {
                          limit += 50
                        }}
                      />
                    </div>
                  {/if}
                </svelte:fragment>
                <svelte:fragment slot="tools">
                  {#if activeAll.length > 0}
                    <Button
                      icon={IconStop}
                      label={getEmbeddedLabel(`Mass Archive ${activeAll.length}`)}
                      kind={'ghost'}
                      on:click={() => {
                        showPopup(MessageBox, {
                          label: getEmbeddedLabel(`Mass Archive ${activeAll.length}`),
                          message: getEmbeddedLabel(`Please confirm archive ${activeAll.length} workspaces`),
                          action: async () => {
                            void performWorkspaceOperation(
                              activeAll.map((it) => it.uuid),
                              'archive'
                            )
                          }
                        })
                      }}
                    />
                  {/if}

                  {#if regionInfo.length > 0 && activeV.length > 0}
                    <Button
                      icon={IconArrowRight}
                      kind={'positive'}
                      label={getEmbeddedLabel(`Mass Migrate ${activeV.length} to ${selectedRegionName ?? ''}`)}
                      on:click={() => {
                        showPopup(MessageBox, {
                          label: getEmbeddedLabel(`Mass Migrate ${activeV.length}`),
                          message: getEmbeddedLabel(`Please confirm migrate ${activeV.length} workspaces`),
                          action: async () => {
                            await performWorkspaceOperation(
                              activeV.map((it) => it.uuid),
                              'migrate-to',
                              selectedRegionId
                            )
                          }
                        })
                      }}
                    />
                  {/if}
                </svelte:fragment>
                {#each v.slice(0, limit) as workspace}
                  {@const wsName = workspace.name}
                  {@const lastUsageDays = Math.round((now - (workspace.lastVisit ?? 0)) / (1000 * 3600 * 24))}
                  {@const bIdx = backupIdx.get(workspace.uuid)}
                  <!-- svelte-ignore a11y-click-events-have-key-events -->
                  <!-- svelte-ignore a11y-no-static-element-interactions -->
                  <tr class="flex fs-title cursor-pointer focused-button bordered" id={`${workspace.uuid}`}>
                    <div class="label overflow-label p-1 flex flex-row-center" style:width={'15rem'}>
                      {wsName}
                      <div class="ml-1 flex flex-row-center">
                        <Button
                          icon={IconOpen}
                          size={'small'}
                          on:click={() => select(workspace.url)}
                          showTooltip={{ label: getEmbeddedLabel('Open Workspace URL') }}
                        />
                        <Button
                          icon={IconCopy}
                          size={'small'}
                          on:click={() => copyTextToClipboard(workspace.uuid)}
                          showTooltip={{ label: getEmbeddedLabel('Copy UUID') }}
                        />
                      </div>
                    </div>
                    <div class="label overflow-label p-1 flex flex-row-center" style:width={'5rem'}>
                      {workspace.region ?? ''}
                    </div>
                    <div class="label overflow-label p-1 flex flex-row-center" style:width={'5rem'}>
                      {lastUsageDays} days
                    </div>
                    <div class="label overflow-label p-1 flex flex-row-center" style:width={'10rem'}>
                      {workspace.mode ?? '-'}
                    </div>
                    <div class="label overflow-label flex flex-row-center" style:width={'5rem'}>
                      {workspace.processingAttempts}
                      {#if workspace.processingAttempts > 0}
                        <Button
                          on:click={() => {
                            showPopup(MessageBox, {
                              label: getEmbeddedLabel(`Reset attempts ${workspace.url}`),
                              message: getEmbeddedLabel('Please confirm'),
                              action: async () => {
                                await performWorkspaceOperation(workspace.uuid, 'reset-attempts')
                              }
                            })
                          }}
                          icon={IconDownOutline}
                          size={'small'}
                          kind={'ghost'}
                        />
                      {/if}
                    </div>
                    <div class="flex flex-row-center" style:width={'5rem'}>
                      {#if workspace.processingProgress !== 100 && workspace.processingProgress !== 0}
                        ({workspace.processingProgress}%)
                      {/if}
                    </div>
                    <div class="flex flex-row-center" style:width={'15rem'}>
                      {#if workspace.backupInfo != null}
                        {@const sz = Math.max(
                          workspace.backupInfo.backupSize,
                          workspace.backupInfo.dataSize + workspace.backupInfo.blobsSize
                        )}
                        {@const szGb = Math.round((sz * 100) / 1024) / 100}
                        {#if szGb > 0}
                          {Math.round((sz * 100) / 1024) / 100}Gb
                        {:else}
                          {Math.round(sz * 100) / 100}Mb
                        {/if}
                      {/if}
                      {#if bIdx != null}
                        [#{bIdx}]
                      {/if}
                    </div>
                    <div class="flex flex-row-center" style:width={'15rem'}>
                      {#if workspace.backupInfo != null}
                        {@const hours = Math.round((now - workspace.backupInfo.lastBackup) / (1000 * 3600))}

                        {#if hours > 24}
                          {Math.round(hours / 24)} days
                        {:else}
                          {hours} hours
                        {/if}
                      {/if}
                    </div>
                    <div class="flex flex-row-center p-1">
                      {#if workspace.mode === 'active'}
                        <Button
                          icon={IconStop}
                          size={'small'}
                          label={getEmbeddedLabel('Archive')}
                          kind={'ghost'}
                          on:click={() => {
                            showPopup(MessageBox, {
                              label: getEmbeddedLabel(`Archive ${workspace.url}`),
                              message: getEmbeddedLabel('Please confirm'),
                              action: async () => {
                                await performWorkspaceOperation(workspace.uuid, 'archive')
                              }
                            })
                          }}
                        />
                      {/if}

                      {#if workspace.mode === 'archived'}
                        <Button
                          icon={IconStart}
                          size={'small'}
                          kind={'ghost'}
                          label={getEmbeddedLabel('Unarchive')}
                          on:click={() => {
                            showPopup(MessageBox, {
                              label: getEmbeddedLabel(`Unarchive ${workspace.url}`),
                              message: getEmbeddedLabel('Please confirm'),
                              action: async () => {
                                await performWorkspaceOperation(workspace.uuid, 'unarchive')
                              }
                            })
                          }}
                        />
                      {/if}
                      {#if regionInfo.length > 0 && workspace.mode === 'active' && (workspace.region ?? '') !== selectedRegionId}
                        <Button
                          icon={IconArrowRight}
                          size={'small'}
                          kind={'positive'}
                          label={getEmbeddedLabel('Migrate')}
                          on:click={() => {
                            showPopup(MessageBox, {
                              label: getEmbeddedLabel(`Migrate ${workspace.url}`),
                              message: getEmbeddedLabel('Please confirm'),
                              action: async () => {
                                await performWorkspaceOperation(workspace.uuid, 'migrate-to', selectedRegionId)
                              }
                            })
                          }}
                        />
                      {/if}

                      {#if superAdminMode && !isDeletingMode(workspace.mode) && !isArchivingMode(workspace.mode)}
                        <Button
                          icon={IconStop}
                          size={'small'}
                          kind={'dangerous'}
                          label={getEmbeddedLabel('Delete')}
                          on:click={() => {
                            showPopup(MessageBox, {
                              label: getEmbeddedLabel(`Delete ${workspace.url}`),
                              message: getEmbeddedLabel('Please confirm'),
                              action: async () => {
                                await performWorkspaceOperation(workspace.uuid, 'delete')
                              }
                            })
                          }}
                        />
                      {/if}
                    </div>
                  </tr>
                {/each}
              </Expandable>
            {/if}
          {/each}
        </div>
      </Scroller>
    </div>
  </div>
  <Popup />
{/if}
