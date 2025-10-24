#!/bin/bash

# This script removes all deployed resources and deletes the cluster

set -e 

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' 

CLUSTER_NAME="${CLUSTER_NAME:-routegate-cluster}"
ZONE="${ZONE:-us-central1-a}"

echo -e "${RED}WARNING: This will delete all RouteGate resources${NC}"
echo

read -p "Are you sure you want to continue? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo
echo -e "${YELLOW}Deleting Kubernetes resources...${NC}"

kubectl delete -f k8s/7-hpa.yaml --ignore-not-found=true
kubectl delete -f k8s/6-frontend-deployment.yaml --ignore-not-found=true
kubectl delete -f k8s/5-api-deployment.yaml --ignore-not-found=true
kubectl delete -f k8s/4-weather-deployment.yaml --ignore-not-found=true
kubectl delete job init-db --ignore-not-found=true
kubectl delete -f k8s/2-mysql-deployment.yaml --ignore-not-found=true
kubectl delete -f k8s/1-mysql-pv.yaml --ignore-not-found=true

echo
echo -e "${GREEN}All Kubernetes resources have been deleted${NC}"
echo

echo
echo -e "${YELLOW}Deleting GKE cluster...${NC}"
gcloud container clusters delete $CLUSTER_NAME --zone $ZONE --quiet
echo
echo -e "${GREEN}Cluster deleted successfully${NC}"
echo
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Cleanup finished successfully${NC}"
echo -e "${GREEN}========================================${NC}"


