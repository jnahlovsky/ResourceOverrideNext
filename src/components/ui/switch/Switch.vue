<script setup>
import { reactiveOmit } from "@vueuse/core";
import { SwitchRoot, SwitchThumb, useForwardPropsEmits } from "reka-ui";
import { cn } from "@/lib/utils";

const props = defineProps({
  defaultValue: { type: null, required: false },
  modelValue: { type: null, required: false },
  disabled: { type: Boolean, required: false },
  id: { type: String, required: false },
  value: { type: String, required: false },
  trueValue: { type: null, required: false },
  falseValue: { type: null, required: false },
  asChild: { type: Boolean, required: false },
  as: { type: null, required: false },
  name: { type: String, required: false },
  required: { type: Boolean, required: false },
  class: {
    type: [Boolean, null, String, Object, Array],
    required: false,
    skipCheck: true,
  },
  size: { type: String, required: false, default: "default" },
});

const emits = defineEmits(["update:modelValue"]);

const delegatedProps = reactiveOmit(props, "class", "size");

const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <SwitchRoot
    v-slot="slotProps"
    data-slot="switch"
    :data-size="size"
    v-bind="forwarded"
    :class="
      cn(
        'data-checked:bg-[#2563eb] data-unchecked:bg-slate-300 shrink-0 rounded-full border-2 border-transparent focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 data-[size=default]:h-5 data-[size=default]:w-9 data-[size=sm]:h-4 data-[size=sm]:w-7 peer group/switch relative inline-flex items-center transition-colors outline-none cursor-pointer data-disabled:cursor-not-allowed data-disabled:opacity-50',
        props.class,
      )
    "
  >
    <SwitchThumb
      data-slot="switch-thumb"
      class="bg-white rounded-full group-data-[size=default]/switch:size-4 group-data-[size=sm]/switch:size-3 group-data-[size=default]/switch:data-checked:translate-x-4 group-data-[size=sm]/switch:data-checked:translate-x-3 group-data-[size=default]/switch:data-unchecked:translate-x-0 group-data-[size=sm]/switch:data-unchecked:translate-x-0 pointer-events-none block shadow-sm transition-transform"
    >
      <slot name="thumb" v-bind="slotProps" />
    </SwitchThumb>
  </SwitchRoot>
</template>
