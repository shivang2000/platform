<!--
// Copyright © 2022 Hardcore Engineering Inc.
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
  import { AttachmentStyledBox } from '@hcengineering/attachment-resources'
  import calendar, { Calendar, generateEventId } from '@hcengineering/calendar'
  import contact, { Employee } from '@hcengineering/contact'
  import { EmployeeBox } from '@hcengineering/contact-resources'
  import core, { DocumentQuery, generateId, Markup, Ref } from '@hcengineering/core'
  import { Request, RequestType, Staff } from '@hcengineering/hr'
  import { translate } from '@hcengineering/platform'
  import { Card, createQuery, getClient } from '@hcengineering/presentation'
  import { EmptyMarkup } from '@hcengineering/text'
  import ui, {
    Button,
    DateRangePresenter,
    DropdownLabelsIntl,
    IconAttachment,
    Label,
    themeStore
  } from '@hcengineering/ui'
  import { createEventDispatcher } from 'svelte'
  import hr from '../plugin'
  import { getRequests } from '../utils'

  export let staff: Staff
  export let date: Date
  export let readonly: boolean
  export let docQuery: DocumentQuery<Employee> | undefined
  export let employeeRequests: Map<Ref<Staff>, Request[]>

  let description: Markup = EmptyMarkup
  let employee: Ref<Employee> = staff._id

  const objectId: Ref<Request> = generateId()
  let descriptionBox: AttachmentStyledBox

  const dispatch = createEventDispatcher()
  const client = getClient()
  const typesQuery = createQuery()

  let types: RequestType[] = []
  let type: RequestType | undefined = undefined
  let typeLabel = ''
  $: type && translate(type.label, {}, $themeStore.language).then((p) => (typeLabel = p))

  typesQuery.query(hr.class.RequestType, {}, (res) => {
    types = res
    if (type === undefined) {
      type = types[0]
    }
  })

  let value = new Date(date).getTime()
  $: dueDate = new Date(value).getTime()

  export function canClose (): boolean {
    return description.length === 0
  }

  // async function saveRequest () {
  //   let date: number | undefined
  //   if (value != null) date = value
  //   if (date === undefined) return
  //   if (type === undefined) return
  //   if (employee === null) return
  //   await client.addCollection(hr.class.Request, core.space.Workspace, employee, staff._class, 'requests', {
  //     type: type._id,
  //     tzDate: timeToTzDate(date),
  //     tzDueDate: timeToTzDate(dueDate),
  //     description,
  //     department: staff.department
  //   })
  //   await descriptionBox.createAttachments()
  // }

  export function saveUTC (date: Timestamp): Timestamp { // todo: decide with this
    const utcdate = new Date(date)
    return Date.UTC(
      utcdate.getFullYear(),
      utcdate.getMonth(),
      utcdate.getDate(),
      utcdate.getHours(),
      utcdate.getMinutes(),
      utcdate.getSeconds(),
      utcdate.getMilliseconds()
    )
  }

  async function createEvent (): Promise<void> {
    let date: number | undefined
    if (value != null) date = value
    if (date === undefined) return
    if (type === undefined) return
    if (employee === null) return

    const allDayDuration = 24 * 60 * 60 * 1000 - 1 // todo: duplicated code
    const startDate = new Date(date).setHours(0, 0, 0, 0)
    if (dueDate - startDate < allDayDuration) dueDate = allDayDuration + startDate
    else dueDate = new Date(dueDate).setHours(23, 59, 59, 999)

    const account = await client.findOne(contact.class.PersonAccount, {
      person: employee
    })
    if (account === undefined) return

    const eventId = generateEventId()
    await client.addCollection(
      calendar.class.Event,
      calendar.space.Calendar,
      calendar.ids.NoAttached,
      calendar.class.Event,
      'events',
      {
        calendar: `${account._id}_calendar`,
        eventId: generateEventId(),
        date: saveUTC(startDate),
        dueDate: saveUTC(dueDate),
        externalParticipants: [],
        description,
        visibility: 'public',
        participants: [employee],
        reminders: [86400000], // todo: test - 1 day
        title: typeLabel,
        location: '',
        allDay: true,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, // todo: get timezone
        access: 'owner' // ?
      },
      eventId
    )

    await client.createMixin(
      eventId as Ref<Event>,
      calendar.class.Event,
      calendar.space.Calendar,
      hr.mixin.HREvent,
      {
        type: type._id
      }
    )
  }

  async function findCalendarId (): Promise<Ref<Calendar> | undefined> { // todo: decide with this
    const account = await client.findOne(contact.class.PersonAccount, {
      person: staff._id
    })

    return account !== undefined
      ? `${account._id}_calendar` as Ref<Calendar>
      : undefined
  }

  function typeSelected (_id: Ref<RequestType>): void {
    type = types.find((p) => p._id === _id)
  }

  function moreThanLimit (
    employeeRequests: Map<Ref<Staff>, Request[]>,
    staff: Staff,
    startDate: Date,
    endDate: Date,
    type: RequestType | undefined
  ): boolean {
    if (employeeRequests === undefined) return true
    if (type === undefined) return true
    const requests = getRequests(employeeRequests, startDate, endDate, staff._id)
    return requests.length > 0
  }
  $: notLimit = moreThanLimit(
    employeeRequests,
    staff,
    new Date(value),
    new Date(new Date(dueDate).setHours(23, 59, 59, 999)),
    type
  )
</script>

<Card
  label={hr.string.CreateRequest}
  labelProps={{ type: typeLabel }}
  okAction={createEvent}
  canSave={value !== undefined && !notLimit}
  gap={'gapV-4'}
  on:close={() => {
    dispatch('close')
  }}
  on:changeContent
>
  <svelte:fragment slot="header">
    <EmployeeBox
      label={hr.string.SelectEmployee}
      placeholder={hr.string.SelectEmployee}
      kind={'regular'}
      size={'large'}
      bind:value={employee}
      {readonly}
      showNavigate={false}
      {docQuery}
    />
  </svelte:fragment>
  <DropdownLabelsIntl
    items={types.map((p) => {
      return { id: p._id, label: p.label }
    })}
    label={hr.string.RequestType}
    on:selected={(e) => {
      typeSelected(e.detail)
    }}
  />
  <AttachmentStyledBox
    bind:this={descriptionBox}
    {objectId}
    _class={hr.class.Request}
    space={core.space.Workspace}
    alwaysEdit
    showButtons={false}
    maxHeight={'card'}
    bind:content={description}
    placeholder={core.string.Description}
  />
  <svelte:fragment slot="pool">
    <DateRangePresenter bind:value editable labelNull={ui.string.SelectDate} kind={'regular'} size={'large'} />
    <DateRangePresenter
      bind:value={dueDate}
      labelNull={calendar.string.DueTo}
      editable
      kind={'regular'}
      size={'large'}
    />
  </svelte:fragment>
  <svelte:fragment slot="footer">
    <Button
      icon={IconAttachment}
      size={'large'}
      on:click={() => {
        descriptionBox.handleAttach()
      }}
    />
  </svelte:fragment>
  <svelte:fragment slot="error">
    {#if notLimit}
      <Label label={hr.string.ExistingRequests} />
    {/if}
  </svelte:fragment>
</Card>
