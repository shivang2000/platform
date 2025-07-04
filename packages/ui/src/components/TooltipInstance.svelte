<!--
// Copyright © 2020 Anticrm Platform Contributors.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
-->
<script lang="ts">
  import { afterUpdate, onDestroy } from 'svelte'
  import { resizeObserver } from '../resize'
  import { closeTooltip, tooltipstore as tooltip } from '../tooltips'
  import { modalStore as modals } from '../modals'
  import type { TooltipAlignment } from '../types'
  import Component from './Component.svelte'
  import Label from './Label.svelte'
  import { capitalizeFirstLetter, formatKey } from '../utils'
  import { testing } from '..'

  let tooltipHTML: HTMLElement
  let nubHTML: HTMLElement
  let dir: TooltipAlignment
  let rect: DOMRect | undefined
  let rectAnchor: DOMRect
  let tooltipSW: boolean // tooltipSW = true - Label; false - Component
  let nubDirection: 'top' | 'bottom' | 'left' | 'right' | undefined = undefined
  let clWidth: number
  let docWidth: number
  let docHeight: number
  let shown: boolean = false

  $: tooltipSW = !$tooltip.component && $tooltip.kind !== 'submenu'
  $: onUpdate = $tooltip.onUpdate
  $: kind = $tooltip.kind

  interface TooltipOptions {
    top: string
    bottom: string
    left: string
    right: string
    width: string
    height: string
    maxWidth: string
    transform: string
    visibility: string
    classList: string
  }

  let options: TooltipOptions = {
    top: '',
    bottom: '',
    left: '',
    right: '',
    width: '',
    height: '',
    maxWidth: '',
    transform: '',
    visibility: 'hidden',
    classList: ''
  }

  const clearStyles = (): void => {
    shown = false
    options = {
      top: '',
      bottom: '',
      left: '',
      right: '',
      width: '',
      height: '',
      maxWidth: '',
      transform: '',
      visibility: 'hidden',
      classList: ''
    }
  }

  const fitTooltip = (tooltipHTMLToCheck: HTMLElement, clWidth?: number): TooltipOptions => {
    const options: TooltipOptions = {
      top: '',
      bottom: '',
      left: '',
      right: '',
      width: '',
      height: '',
      transform: '',
      maxWidth: '',
      visibility: 'visible',
      classList: ''
    }
    if (($tooltip.label || $tooltip.component) && tooltipHTML && tooltipHTMLToCheck) {
      if (clWidth === undefined) {
        clWidth = tooltipHTML.clientWidth
      }

      let isElementInvalidTarget = false

      if ($tooltip.element) {
        rect = $tooltip.element.getBoundingClientRect()
        rectAnchor = $tooltip.anchor
          ? $tooltip.anchor.getBoundingClientRect()
          : $tooltip.element.getBoundingClientRect()

        if (rect.x === 0 && rect.y === 0 && rect.width === 0 && rect.height === 0) {
          isElementInvalidTarget = true
        }

        if ($tooltip.component) {
          clearStyles()
          if (rect.bottom + tooltipHTMLToCheck.clientHeight + 28 < docHeight) {
            options.top = `calc(${rect.bottom}px + 5px + .25rem)`
            dir = 'bottom'
          } else if (rect.top > docHeight - rect.bottom) {
            options.bottom = `calc(${docHeight - rect.y}px + 5px + .25rem)`
            if (tooltipHTML.clientHeight > rect.top - 28) {
              options.top = '1rem'
              options.height = `calc(${rect.top}px - 5px - 1.25rem)`
            }
            dir = 'top'
          } else {
            options.top = `calc(${rect.bottom}px + 5px + .25rem)`
            if (tooltipHTMLToCheck.clientHeight > docHeight - rect.bottom - 28) {
              options.bottom = '1rem'
              options.height = `calc(${docHeight - rect.bottom}px - 5px - 1.25rem)`
            }
            dir = 'bottom'
          }

          const tempLeft = rect.width / 2 + rect.left - clWidth / 2
          if (tempLeft + clWidth > docWidth - 8) options.right = '.5rem'
          else if (tempLeft < 8) options.left = '.5rem'
          else options.left = `${tempLeft}px`

          if (nubHTML) {
            nubHTML.style.top = rect.top + 'px'
            nubHTML.style.left = rect.left + 'px'
            nubHTML.style.width = rect.width + 'px'
            nubHTML.style.height = rect.height + 'px'
            nubDirection = dir
          }
        } else {
          if (!$tooltip.direction) {
            if (rectAnchor.right < docWidth / 5) dir = 'right'
            else if (rectAnchor.left > docWidth - docWidth / 5) dir = 'left'
            else if (rectAnchor.top < tooltipHTMLToCheck.clientHeight) dir = 'bottom'
            else dir = 'top'
          } else dir = $tooltip.direction

          if (dir === 'right') {
            const maxWidth = Math.min(docWidth / 2, docWidth - rectAnchor.right)
            options.top = rectAnchor.y + rectAnchor.height / 2 + 'px'
            options.left = `calc(${rectAnchor.right}px + .75rem)`
            options.maxWidth = `calc(${maxWidth}px - 1.5rem)`
            options.transform = 'translateY(-50%)'
          } else if (dir === 'left') {
            const maxWidth = Math.min(docWidth / 2, rectAnchor.x)
            options.top = rectAnchor.y + rectAnchor.height / 2 + 'px'
            options.right = `calc(${docWidth - rectAnchor.x}px + .75rem)`
            options.maxWidth = `calc(${maxWidth}px - 1.5rem)`
            options.transform = 'translateY(-50%)'
          } else if (dir === 'bottom') {
            const left = rectAnchor.x + rectAnchor.width / 2
            const maxWidth = Math.min(left, docWidth - left)

            options.top = `calc(${rectAnchor.bottom}px + .5rem)`
            options.left = rectAnchor.x + rectAnchor.width / 2 + 'px'
            options.maxWidth = `calc(${maxWidth * 2}px - 1.5rem)`
            options.transform = 'translateX(-50%)'
          } else if (dir === 'top') {
            const left = rectAnchor.x + rectAnchor.width / 2
            const maxWidth = Math.min(left, docWidth - left)

            options.bottom = `calc(${docHeight - rectAnchor.y}px + .75rem)`
            options.left = rectAnchor.x + rectAnchor.width / 2 + 'px'
            options.maxWidth = `calc(${maxWidth * 2}px - 1.5rem)`
            options.transform = 'translateX(-50%)'
          }
        }
      } else {
        options.top = '50%'
        options.left = '50%'
        options.width = 'min-content'
        options.height = 'min-content'
        options.transform = 'translate(-50%, -50%)'
        options.classList = 'no-arrow'
      }
      if (isElementInvalidTarget) {
        options.visibility = 'hidden'
        shown = false
      } else {
        options.visibility = 'visible'
        shown = true
      }
    } else if (tooltipHTML) {
      shown = false
      options.visibility = 'hidden'
    }
    return options
  }

  const fitSubmenu = (): TooltipOptions => {
    const options: TooltipOptions = {
      top: '',
      bottom: '',
      left: '',
      right: '',
      width: '',
      height: '',
      maxWidth: '',
      visibility: 'visible',
      transform: '',
      classList: ''
    }
    if (($tooltip.label || $tooltip.component) && tooltipHTML) {
      if ($tooltip.element) {
        rect = $tooltip.element.getBoundingClientRect()
        const rectP = tooltipHTML.getBoundingClientRect()
        const dirH =
          docWidth - rect.right - rectP.width - 16 > 0 ? 'right' : rect.left > docWidth - rect.right ? 'left' : 'right'
        const dirV =
          docHeight - rect.top - rectP.height - 16 > 0
            ? 'bottom'
            : rect.bottom > docHeight - rect.top
              ? 'top'
              : 'bottom'
        if (dirH === 'right') {
          options.left = rect.right - 4 + 'px'
        } else {
          options.right = docWidth - rect.left - 4 + 'px'
        }
        if (dirV === 'bottom') {
          options.top = rect.top - 4 + 'px'
        } else {
          options.bottom = docHeight - rect.bottom - 4 + 'px'
        }
        options.visibility = 'visible'
      }
    } else if (tooltipHTML) {
      options.visibility = 'hidden'
    }
    return options
  }

  const hideTooltip = (): void => {
    if (tooltipHTML) options.visibility = 'hidden'
    shown = false
    closeTooltip()
  }

  $: shownTooltip = $tooltip.element && tooltipHTML

  const whileShow = (ev: MouseEvent): void => {
    if (!$tooltip.element) return
    const rectP = tooltipHTML.getBoundingClientRect()
    rect = $tooltip.element.getBoundingClientRect()
    const dT: number = dir === 'bottom' && $tooltip.kind !== 'submenu' ? 12 : 0
    const dB: number = dir === 'top' && $tooltip.kind !== 'submenu' ? 12 : 0
    const inTrigger: boolean = ev.x >= rect.left && ev.x <= rect.right && ev.y >= rect.top && ev.y <= rect.bottom
    const inPopup: boolean =
      ev.x >= rectP.left && ev.x <= rectP.right && ev.y >= rectP.top - dT && ev.y <= rectP.bottom + dB

    if ($tooltip.kind !== 'popup') {
      if ((tooltipSW && !inTrigger) || !(inTrigger || inPopup)) hideTooltip()
    }
  }

  $: if (kind === 'submenu') {
    options = fitSubmenu()
  } else {
    options = fitTooltip(tooltipHTML, clWidth)
  }
  afterUpdate(() => {
    if (kind === 'submenu') {
      options = fitSubmenu()
    } else {
      options = fitTooltip(tooltipHTML, clWidth)
    }
  })
  onDestroy(() => {
    hideTooltip()
  })
</script>

{#if $tooltip.kind === 'popup'}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div
    class="modal-overlay antiOverlay"
    style:z-index={($modals.findIndex((t) => t.type === 'tooltip') ?? 1) + 10000}
    on:click|stopPropagation|preventDefault={() => {
      closeTooltip()
    }}
    on:keydown|stopPropagation|preventDefault={() => {}}
  />
{/if}

<svelte:window
  bind:innerWidth={docWidth}
  bind:innerHeight={docHeight}
  on:resize={() => {
    if ($tooltip.kind !== 'popup') {
      hideTooltip()
    }
  }}
  on:mousemove={(ev) => {
    if (shownTooltip) whileShow(ev)
  }}
  on:keydown={(evt) => {
    if (($tooltip.component || $tooltip.label) && evt.key === 'Escape' && $tooltip.kind !== 'popup') {
      evt.preventDefault()
      evt.stopImmediatePropagation()
      hideTooltip()
    }
  }}
/>
{#if $tooltip.component && $tooltip.kind !== 'submenu'}
  <div
    class="popup-tooltip {options.classList} {$tooltip.style}"
    class:testing
    class:shown
    class:doublePadding={$tooltip.label}
    use:resizeObserver={(element) => {
      clWidth = element.clientWidth
      options = fitTooltip(tooltipHTML, clWidth)
    }}
    style:top={options.top}
    style:bottom={options.bottom}
    style:left={options.left}
    style:right={options.right}
    style:width={options.width}
    style:height={options.height}
    style:transform={options.transform}
    style:z-index={($modals.findIndex((t) => t.type === 'tooltip') ?? 1) + 10000}
    bind:this={tooltipHTML}
  >
    {#if $tooltip.label}
      <div class="fs-title mb-4">
        <Label label={$tooltip.label} params={$tooltip.props ?? {}} />
      </div>
    {/if}
    {#if typeof $tooltip.component === 'string'}
      <Component
        is={$tooltip.component}
        props={$tooltip.props}
        on:update={onUpdate !== undefined ? onUpdate : async () => {}}
      />
    {:else}
      <svelte:component
        this={$tooltip.component}
        {...$tooltip.props}
        on:tooltip={(evt) => {
          $modals = [...$modals.filter((t) => t.type !== 'tooltip'), { ...$tooltip, ...evt.detail }]
        }}
        on:update={onUpdate !== undefined ? onUpdate : async () => {}}
      />
    {/if}
  </div>
  <svg class="svg-mask">
    <clipPath id="nub-bg">
      <path
        d="M7.3.6 4.2 4.3C2.9 5.4 1.5 6 0 6v1h18V6c-1.5 0-2.9-.6-4.2-1.7L10.7.6C9.9-.1 8.5-.2 7.5.4c0 .1-.1.1-.2.2z"
      />
    </clipPath>
    <clipPath id="nub-border">
      <path
        d="M4.8 5.1 8 1.3s.1 0 .1-.1c.5-.3 1.4-.3 1.9.1L13.1 5l.1.1 1.2.9H18c-1.5 0-2.9-.6-4.2-1.7L10.7.6C9.9-.1 8.5-.2 7.5.4c0 .1-.1.1-.2.2L4.2 4.3C2.9 5.4 1.5 6 0 6h3.6l1.2-.9z"
      />
    </clipPath>
  </svg>
  {#if !$tooltip.noArrow}
    <div
      bind:this={nubHTML}
      style:z-index={($modals.findIndex((t) => t.type === 'tooltip') ?? 1) + 10000}
      class="nub {nubDirection ?? ''}"
      class:testing
      class:shown
    />
  {/if}
{:else if $tooltip.label && $tooltip.kind !== 'submenu'}
  <div
    class="tooltip {dir ?? ''} {options.classList}"
    bind:this={tooltipHTML}
    style:top={options.top}
    style:bottom={options.bottom}
    style:left={options.left}
    style:right={options.right}
    style:width={options.width}
    style:height={options.height}
    style:max-width={options.maxWidth}
    style:transform={options.transform}
    style:visibility={options.visibility}
    style:z-index={($modals.findIndex((t) => t.type === 'tooltip') ?? 1) + 10000}
  >
    <span class="label">
      <Label label={$tooltip.label} params={$tooltip.props ?? {}} />
    </span>
    {#if $tooltip.keys !== undefined}
      <div class="keys">
        {#each $tooltip.keys as key, i}
          {#if i !== 0}
            <div class="mr-1 ml-1">/</div>
          {/if}
          {#each formatKey(key) as k, jj}
            <div class="key">
              {#each k as kk, j}
                {#if j !== 0}
                  +
                {/if}
                {capitalizeFirstLetter(kk.trim())}
              {/each}
            </div>
          {/each}
        {/each}
      </div>
    {/if}
  </div>
{:else if $tooltip.kind === 'submenu'}
  <div
    class="submenu-container {dir ?? ''} {options.classList}"
    use:resizeObserver={(element) => {
      clWidth = element.clientWidth
    }}
    style:top={options.top}
    style:bottom={options.bottom}
    style:left={options.left}
    style:right={options.right}
    style:width={options.width}
    style:height={options.height}
    style:transform={options.transform}
    style:z-index={($modals.findIndex((t) => t.type === 'tooltip') ?? 1) + 10000}
    bind:this={tooltipHTML}
  >
    {#if typeof $tooltip.component === 'string'}
      <Component
        is={$tooltip.component}
        props={$tooltip.props}
        on:update={onUpdate !== undefined ? onUpdate : async () => {}}
      />
    {:else}
      <svelte:component
        this={$tooltip.component}
        {...$tooltip.props}
        on:update={onUpdate !== undefined ? onUpdate : async () => {}}
      />
    {/if}
  </div>
{/if}

<style lang="scss">
  .submenu-container {
    position: fixed;
    width: auto;
    height: auto;
    border-radius: 0.5rem;
  }
  .popup-tooltip {
    overflow: hidden;
    position: fixed;
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    max-width: 60vw;
    color: var(--theme-content-color);
    background-color: var(--theme-popup-color);
    border: 1px solid var(--theme-popup-divider);
    border-radius: 0.75rem;
    box-shadow: var(--theme-popup-shadow);
    user-select: none;

    &.doublePadding {
      padding: 1rem;
    }
    &.modern {
      padding: 0;
      border: none;
      outline: none;
      border-radius: 1.5rem;
      box-shadow:
        0 6.25rem 5rem rgba(0, 0, 0, 0.15),
        0 2.5rem 2rem rgba(0, 0, 0, 0.12),
        0 1.5rem 1rem rgba(0, 0, 0, 0.1),
        0 0.75rem 0.75rem rgba(0, 0, 0, 0.1),
        0 0.375rem 0.375rem rgba(0, 0, 0, 0.08),
        0 0.125rem 0.125rem rgba(0, 0, 0, 0.05);
    }
    &.disabled {
      background-color: var(--popup-color-disabled);
    }
  }
  .popup-tooltip,
  .nub {
    opacity: 0;
    transition: opacity 0.1s ease-in-out;

    &.testing {
      transition-duration: 0 !important;
    }
  }
  .shown {
    opacity: 1;
    transition: opacity 0.1s ease-in-out 0.05s;
  }

  .nub {
    position: fixed;
    // background-color: rgba(255, 255, 0, .5);
    user-select: none;
    pointer-events: none;

    &::after,
    &::before {
      position: absolute;
      width: 18px;
      height: 7px;
    }
    &::before {
      background-color: var(--theme-popup-color);
      clip-path: url('#nub-bg');
      z-index: 1;
    }
    &::after {
      background-color: var(--theme-popup-divider);
      clip-path: url('#nub-border');
      z-index: 2;
    }

    &.top::after,
    &.bottom::after,
    &.top::before,
    &.bottom::before,
    &.right::after,
    &.left::after,
    &.right::before,
    &.left::before {
      content: '';
    }
    &.top::after,
    &.bottom::after,
    &.top::before,
    &.bottom::before {
      left: 50%;
      margin-left: -9px;
    }
    &.top::after,
    &.top::before {
      top: calc(-7px - 0.25rem);
      transform: rotate(180deg);
    }
    &.bottom::after,
    &.bottom::before {
      bottom: calc(-7px - 0.25rem);
    }

    &.right::after,
    &.left::after,
    &.right::before,
    &.left::before {
      top: 50%;
      margin-top: -9px;
    }
    &.left::after,
    &.left::before {
      transform-origin: left top;
      left: -0.25rem;
      transform: rotate(90deg);
    }
    &.right::after,
    &.right::before {
      transform-origin: right top;
      right: -0.25rem;
      transform: rotate(-90deg);
    }
  }

  .keys {
    margin-left: 0.5rem;
    display: flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.125rem;
  }

  .key {
    border-radius: 0.125rem;
    font-size: 0.75rem;
    min-width: 1.5rem;
    padding: 0.25rem;
    background-color: var(--theme-tooltip-key-bg);
  }

  .tooltip {
    position: fixed;
    padding: 0.5rem;
    text-align: center;
    font-size: 0.75rem;
    color: var(--theme-tooltip-color);
    background-color: var(--theme-tooltip-bg);
    border: 1px solid var(--theme-popup-divider);
    border-radius: 0.25rem;
    box-shadow: var(--theme-popup-shadow);
    user-select: none;
    display: flex;
    align-items: center;

    &::before {
      background-color: var(--theme-popup-color);
      clip-path: url('#nub-bg');
      z-index: 1;
    }
    &::after {
      background-color: var(--theme-popup-divider);
      clip-path: url('#nub-border');
      z-index: 2;
    }

    &:not(:has(.key, .keys)) span.label {
      width: 100%;
      word-wrap: break-word;
    }
  }
  .no-arrow {
    box-shadow: 0px 0px 20px rgba(0, 0, 0, 0.75);
    &::after,
    &::before {
      content: none;
    }
  }
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100vh;
    pointer-events: all;
    touch-action: none;
  }
</style>
