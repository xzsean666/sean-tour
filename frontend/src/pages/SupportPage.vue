<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Message from 'primevue/message';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';
import Textarea from 'primevue/textarea';
import {
  supportService,
  type SupportConversationItem,
  type SupportConversationStatus,
  type SupportMessageItem,
  type SupportWorkspaceTemplate,
} from '../api/supportService';

const SUPPORT_POLL_INTERVAL_MS = 15000;

const conversation = ref<SupportConversationItem | null>(null);
const issueStarters = ref<SupportWorkspaceTemplate[]>([]);
const loading = ref(false);
const sending = ref(false);
const errorMessage = ref('');
const draftMessage = ref('');

let pollHandle: number | undefined;

const assignedAgentLabel = computed(
  () => conversation.value?.assignedAgentId || 'Pending auto-assignment',
);
const messageCount = computed(() => conversation.value?.messages.length ?? 0);
const conversationIdLabel = computed(() => {
  if (!conversation.value || conversation.value.id.startsWith('draft_')) {
    return 'Created on first message';
  }

  return conversation.value.id;
});

function formatDate(value: string): string {
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusSeverity(
  status: SupportConversationStatus,
): 'success' | 'info' | 'warn' | 'danger' | 'contrast' {
  if (status === 'WAITING_USER') {
    return 'success';
  }

  if (status === 'IN_PROGRESS') {
    return 'info';
  }

  if (status === 'CLOSED') {
    return 'contrast';
  }

  if (status === 'RESOLVED') {
    return 'success';
  }

  return 'warn';
}

function isUserMessage(message: SupportMessageItem): boolean {
  return message.senderRole === 'USER';
}

function applyIssueStarter(content: string): void {
  draftMessage.value = draftMessage.value.trim()
    ? `${draftMessage.value.trim()}\n\n${content}`
    : content;
}

async function loadIntakeConfig(): Promise<void> {
  try {
    issueStarters.value = (await supportService.getIntakeConfig()).issueStarters;
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load support starters.';
  }
}

async function loadConversation(showSpinner: boolean = false): Promise<void> {
  if (showSpinner) {
    loading.value = true;
  }

  try {
    conversation.value = await supportService.getMyConversation();
    errorMessage.value = '';
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to load support conversation.';
  } finally {
    if (showSpinner) {
      loading.value = false;
    }
  }
}

async function sendMessage(): Promise<void> {
  const content = draftMessage.value.trim();
  if (!content) {
    errorMessage.value = 'Type a message before sending.';
    return;
  }

  sending.value = true;
  errorMessage.value = '';

  try {
    conversation.value = await supportService.sendMessage(content);
    draftMessage.value = '';
  } catch (error) {
    errorMessage.value =
      error instanceof Error ? error.message : 'Failed to send support message.';
  } finally {
    sending.value = false;
  }
}

onMounted(async () => {
  await Promise.all([loadConversation(true), loadIntakeConfig()]);
  pollHandle = window.setInterval(() => {
    void loadConversation(false);
  }, SUPPORT_POLL_INTERVAL_MS);
});

onBeforeUnmount(() => {
  if (pollHandle) {
    window.clearInterval(pollHandle);
  }
});
</script>

<template>
  <section
    class="relative overflow-hidden rounded-3xl border border-[#0c6d64]/20 bg-gradient-to-br from-[#0b2d38] via-[#0f5056] to-[#1a354f] px-6 py-8 text-white shadow-[0_26px_90px_-55px_rgba(7,41,46,0.95)]"
  >
    <div class="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-[#f8b03c]/18 blur-3xl" />
    <div class="absolute -left-16 -bottom-24 h-52 w-52 rounded-full bg-[#2ad0a1]/18 blur-3xl" />

    <p class="relative text-xs font-semibold uppercase tracking-[0.16em] text-teal-100/90">
      Support Chat
    </p>
    <h1 class="relative mt-2 text-3xl font-semibold leading-tight">Talk to Sean Tour Support</h1>
    <p class="relative mt-3 max-w-2xl text-sm text-teal-50/90">
      Registered users can chat directly with the support team. Your history stays in one thread,
      while the support side can hand over between agents without losing context.
    </p>
  </section>

  <Message v-if="errorMessage" severity="error" class="mt-4">{{ errorMessage }}</Message>

  <section class="mt-6 grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
    <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
      <template #title>
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-xl font-semibold text-slate-900">Conversation</h2>
            <p class="mt-1 text-sm text-slate-600">
              This thread is private to your account.
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2" v-if="conversation">
            <Tag :value="conversation.status" :severity="getStatusSeverity(conversation.status)" rounded />
            <Tag :value="assignedAgentLabel" severity="contrast" rounded />
          </div>
        </div>
      </template>

      <template #content>
        <div v-if="loading" class="flex justify-center py-14">
          <ProgressSpinner style="width: 36px; height: 36px" stroke-width="6" />
        </div>

        <div v-else class="space-y-4">
          <div
            class="max-h-[28rem] space-y-3 overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50/80 p-4"
          >
            <div
              v-if="conversation && conversation.messages.length === 0"
              class="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-sm text-slate-500"
            >
              No messages yet. Send the first message and the system will route you to an active
              support agent.
            </div>

            <div
              v-for="message in conversation?.messages || []"
              :key="message.id"
              class="flex"
              :class="isUserMessage(message) ? 'justify-end' : 'justify-start'"
            >
              <div
                class="max-w-[85%] rounded-3xl px-4 py-3 shadow-sm"
                :class="
                  isUserMessage(message)
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-800'
                "
              >
                <p class="text-xs font-semibold uppercase tracking-[0.12em] opacity-75">
                  {{ isUserMessage(message) ? 'You' : message.senderUserId }}
                </p>
                <p class="mt-2 whitespace-pre-wrap text-sm leading-6">{{ message.content }}</p>
                <p class="mt-2 text-[11px] opacity-70">
                  {{ formatDate(message.createdAt) }}
                </p>
              </div>
            </div>
          </div>

          <label class="block space-y-2">
            <span class="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
              New Message
            </span>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="starter in issueStarters"
                :key="starter.label"
                type="button"
                class="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:border-slate-500"
                @click="applyIssueStarter(starter.content)"
              >
                {{ starter.label }}
              </button>
            </div>
            <Textarea
              v-model="draftMessage"
              rows="5"
              auto-resize
              class="w-full"
              placeholder="Describe your issue, booking question, or payment problem."
            />
          </label>

          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-xs text-slate-500">
              We refresh this thread every 15 seconds while the page is open.
            </p>
            <div class="flex items-center gap-2">
              <Button
                label="Refresh"
                icon="pi pi-refresh"
                text
                :disabled="loading || sending"
                @click="loadConversation(false)"
              />
              <Button
                label="Send Message"
                icon="pi pi-send"
                class="!rounded-xl"
                :loading="sending"
                @click="sendMessage"
              />
            </div>
          </div>
        </div>
      </template>
    </Card>

    <div class="grid gap-4">
      <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
        <template #title>
          <h2 class="text-lg font-semibold text-slate-900">Thread Snapshot</h2>
        </template>
        <template #content>
          <dl v-if="conversation" class="space-y-3 text-sm text-slate-700">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-500">Conversation ID</dt>
              <dd class="font-medium text-slate-900">{{ conversationIdLabel }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-500">Assigned Agent</dt>
              <dd class="font-medium text-slate-900">{{ assignedAgentLabel }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-500">Message Count</dt>
              <dd class="font-medium text-slate-900">{{ messageCount }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-slate-500">Last Updated</dt>
              <dd class="font-medium text-slate-900">{{ formatDate(conversation.updatedAt) }}</dd>
            </div>
          </dl>
        </template>
      </Card>

      <Card class="!rounded-3xl !border !border-slate-200/90 !bg-white/95">
        <template #title>
          <h2 class="text-lg font-semibold text-slate-900">How It Works</h2>
        </template>
        <template #content>
          <div class="space-y-3 text-sm leading-6 text-slate-700">
            <p>Only your own account can see this thread.</p>
            <p>Active support agents are auto-assigned in the background.</p>
            <p>
              If no agent is active right now, you can still leave a message and the thread will
              wait in queue.
            </p>
          </div>
        </template>
      </Card>
    </div>
  </section>
</template>
