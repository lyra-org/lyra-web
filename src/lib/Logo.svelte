<!--
This Source Code Form is subject to the terms of the Lyra Public License,
v1.0. If a copy of the Lyra Public License was not distributed with this file,
You can obtain one here:
www.meshiplaw.com/lyra.
-->

<script lang="ts">
  import logoDark from "../assets/logo.svg";
  import logoLight from "../assets/logo-light.svg";

  interface Props {
    class?: string;
  }

  let { class: className = "" }: Props = $props();
</script>

<img src={logoLight} alt="Lyra" class="dark:hidden {className}" />
<img src={logoDark} alt="Lyra" class="hidden dark:block {className}" />
