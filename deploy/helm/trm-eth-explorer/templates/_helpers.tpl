{{- define "trm-eth-explorer.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "trm-eth-explorer.fullname" -}}
{{- default .Chart.Name .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "trm-eth-explorer.labels" -}}
app.kubernetes.io/name: {{ include "trm-eth-explorer.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version }}
{{- end -}}

{{- define "trm-eth-explorer.selectorLabels" -}}
app.kubernetes.io/name: {{ include "trm-eth-explorer.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "trm-eth-explorer.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "trm-eth-explorer.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}
